import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsPartnerCredentials } from '@/lib/feature-pack-schemas';
import { and, eq } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions } from '../lib/partners';
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
function normalizeCredentials(fields, input) {
    const obj = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const out = {};
    for (const f of fields) {
        const raw = obj[f.key];
        if (raw === undefined)
            continue;
        if (f.type === 'number') {
            const n = typeof raw === 'number' ? raw : Number(String(raw));
            if (Number.isFinite(n))
                out[f.key] = n;
            continue;
        }
        if (f.type === 'json') {
            if (typeof raw === 'object') {
                out[f.key] = raw;
            }
            else if (typeof raw === 'string' && raw.trim()) {
                try {
                    out[f.key] = JSON.parse(raw);
                }
                catch {
                    // keep as string; validation will fail if required in strict mode later
                    out[f.key] = raw;
                }
            }
            continue;
        }
        // text/secret
        out[f.key] = typeof raw === 'string' ? raw : String(raw);
    }
    return out;
}
function validateRequired(fields, creds) {
    for (const f of fields) {
        if (!f.required)
            continue;
        const v = creds[f.key];
        if (v === null || v === undefined)
            return `Missing required field: ${f.key}`;
        if (typeof v === 'string' && !v.trim())
            return `Missing required field: ${f.key}`;
    }
    return null;
}
export async function GET(request, ctx) {
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
    const db = getDb();
    const rows = await db.select().from(metricsPartnerCredentials).where(eq(metricsPartnerCredentials.id, id)).limit(1);
    const row = rows[0] ?? null;
    return NextResponse.json({
        definition: def,
        credential: row
            ? {
                id: row.id,
                enabled: row.enabled,
                credentials: row.credentials ?? {},
                lastVerifiedAt: row.lastVerifiedAt ?? null,
                lastVerifyOk: row.lastVerifyOk ?? null,
                lastVerifyMessage: row.lastVerifyMessage ?? null,
            }
            : null,
    });
}
export async function PUT(request, ctx) {
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
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const enabled = body.enabled === false ? false : true;
    const creds = normalizeCredentials(def.fields, body.credentials);
    const requiredError = validateRequired(def.fields, creds);
    if (requiredError)
        return jsonError(requiredError, 400);
    const now = new Date();
    const db = getDb();
    const existing = await db.select({ id: metricsPartnerCredentials.id }).from(metricsPartnerCredentials).where(eq(metricsPartnerCredentials.id, id)).limit(1);
    if (existing.length > 0) {
        await db
            .update(metricsPartnerCredentials)
            .set({
            enabled,
            credentials: creds,
            updatedAt: now,
        })
            .where(and(eq(metricsPartnerCredentials.id, id)));
    }
    else {
        await db.insert(metricsPartnerCredentials).values({
            id,
            enabled,
            credentials: creds,
            createdAt: now,
            updatedAt: now,
        });
    }
    return NextResponse.json({ success: true });
}
export async function DELETE(request, ctx) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const id = ctx.params.id;
    const db = getDb();
    await db.delete(metricsPartnerCredentials).where(eq(metricsPartnerCredentials.id, id));
    return NextResponse.json({ success: true });
}
