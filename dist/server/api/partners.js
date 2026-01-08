import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsPartnerCredentials } from '@/lib/feature-pack-schemas';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions } from '../lib/partners';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function missingRequiredFields(fields, creds) {
    const missing = [];
    for (const f of fields) {
        if (!f.required)
            continue;
        const v = creds[f.key];
        if (v === null || v === undefined) {
            missing.push(f.key);
            continue;
        }
        if (typeof v === 'string' && !v.trim()) {
            missing.push(f.key);
            continue;
        }
    }
    return missing;
}
export async function GET(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const defs = loadPartnerDefinitions();
    const db = getDb();
    const rows = (await db.select().from(metricsPartnerCredentials));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const data = defs.map((d) => {
        const row = byId.get(d.id);
        const creds = row?.credentials && typeof row.credentials === 'object' ? row.credentials : {};
        const missing = row ? missingRequiredFields(d.fields, creds) : d.fields.filter((f) => !!f.required).map((f) => f.key);
        return {
            id: d.id,
            label: d.label,
            description: d.description ?? null,
            fields: d.fields,
            verify: d.verify ?? null,
            configured: !!row && (row.enabled ?? false) && missing.length === 0,
            enabled: row?.enabled ?? false,
            lastVerifiedAt: row?.lastVerifiedAt ?? null,
            lastVerifyOk: row?.lastVerifyOk ?? null,
            lastVerifyMessage: row?.lastVerifyMessage ?? null,
            missingFields: missing,
        };
    });
    const orphans = rows
        .filter((r) => !defs.some((d) => d.id === r.id))
        .map((r) => ({
        id: r.id,
        configured: true,
        enabled: r.enabled,
        lastVerifiedAt: r.lastVerifiedAt ?? null,
        lastVerifyOk: r.lastVerifyOk ?? null,
        lastVerifyMessage: r.lastVerifyMessage ?? null,
    }));
    return NextResponse.json({ data, orphans });
}
