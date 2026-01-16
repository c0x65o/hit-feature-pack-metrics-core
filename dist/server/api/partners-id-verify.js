import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsPartnerCredentials } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions, interpolateTemplate } from '../lib/partners';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function getPartnerOrThrow(id) {
    const defs = loadPartnerDefinitions();
    const p = defs.find((d) => d.id === id);
    if (!p)
        throw new Error(`Unknown partner: ${id}`);
    return p;
}
export async function POST(request, ctx) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const id = ctx.params.id;
    let def;
    try {
        def = getPartnerOrThrow(id);
    }
    catch (e) {
        return jsonError(e instanceof Error ? e.message : 'Unknown partner', 404);
    }
    if (!def.verify)
        return jsonError('No verify action configured for this partner', 400);
    const db = getDb();
    const rows = await db.select().from(metricsPartnerCredentials).where(eq(metricsPartnerCredentials.id, id)).limit(1);
    const cred = rows[0];
    if (!cred)
        return jsonError('Partner is not configured (no credentials saved)', 400);
    if (!cred.enabled)
        return jsonError('Partner is disabled', 400);
    const creds = (cred.credentials ?? {});
    const now = new Date();
    let ok = false;
    let message = '';
    let details = null;
    if (def.verify.kind === 'http') {
        if (!def.verify.url) {
            return jsonError('HTTP verify requires a URL', 400);
        }
        const url = interpolateTemplate(def.verify.url, creds);
        const headers = {};
        if (def.verify.headers) {
            for (const [k, v] of Object.entries(def.verify.headers)) {
                headers[k] = interpolateTemplate(v, creds);
            }
        }
        try {
            const res = await fetch(url, { method: def.verify.method ?? 'GET', headers });
            ok = res.ok;
            const text = await res.text().catch(() => '');
            message = ok ? 'Connection verified' : `Verify failed (${res.status})`;
            details = { status: res.status, body: text.slice(0, 2000) };
        }
        catch (e) {
            ok = false;
            message = e instanceof Error ? e.message : 'Verify failed';
            details = { error: message };
        }
    }
    else if (def.verify.kind === 'command') {
        if (!def.verify.command) {
            return jsonError('Command verify requires a command', 400);
        }
        const envPrefix = def.verify.envPrefix || 'HIT_PARTNER_';
        const env = { ...process.env };
        env[`${envPrefix}ID`] = id;
        for (const [k, v] of Object.entries(creds)) {
            env[`${envPrefix}${k.toUpperCase()}`] = v === null || v === undefined ? '' : String(v);
        }
        const result = spawnSync('bash', ['-lc', def.verify.command], {
            env,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024,
        });
        const stdout = (result.stdout || '').trim();
        const stderr = (result.stderr || '').trim();
        if (stdout) {
            try {
                const parsed = JSON.parse(stdout);
                ok = parsed?.ok === true;
                message = typeof parsed?.message === 'string' ? parsed.message : ok ? 'Connection verified' : 'Verify failed';
                details = parsed?.details && typeof parsed.details === 'object' ? parsed.details : { stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 2000) };
            }
            catch {
                ok = result.status === 0;
                message = ok ? 'Connection verified' : 'Verify failed';
                details = { exitCode: result.status, stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 2000) };
            }
        }
        else {
            ok = result.status === 0;
            message = ok ? 'Connection verified' : 'Verify failed';
            details = { exitCode: result.status, stderr: stderr.slice(0, 2000) };
        }
    }
    await db
        .update(metricsPartnerCredentials)
        .set({
        lastVerifiedAt: now,
        lastVerifyOk: ok,
        lastVerifyMessage: message,
        lastVerifyDetails: details,
        updatedAt: now,
    })
        .where(eq(metricsPartnerCredentials.id, id));
    return NextResponse.json({ ok, message, details });
}
