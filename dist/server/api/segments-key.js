import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsSegments } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function requireAdminOrService(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return { ok: false, res: jsonError('Unauthorized', 401) };
    if (auth.kind === 'service')
        return { ok: true };
    const roles = Array.isArray(auth.user.roles) ? auth.user.roles : [];
    if (!roles.includes('admin'))
        return { ok: false, res: jsonError('Forbidden', 403) };
    return { ok: true };
}
export async function GET(request, ctx) {
    const gate = requireAdminOrService(request);
    if (!gate.ok)
        return gate.res;
    const key = String(ctx?.params?.key || '').trim();
    if (!key)
        return jsonError('Missing key', 400);
    const db = getDb();
    const rows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
    if (!rows.length)
        return jsonError('Not found', 404);
    return NextResponse.json({ data: rows[0] });
}
export async function PUT(request, ctx) {
    const gate = requireAdminOrService(request);
    if (!gate.ok)
        return gate.res;
    const key = String(ctx?.params?.key || '').trim();
    if (!key)
        return jsonError('Missing key', 400);
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const next = {};
    if (typeof body.label === 'string')
        next.label = body.label.trim();
    if (typeof body.description === 'string')
        next.description = body.description;
    if (body.description === null)
        next.description = null;
    if (typeof body.isActive === 'boolean')
        next.isActive = body.isActive;
    if (body.rule !== undefined) {
        const rule = (body.rule && typeof body.rule === 'object' ? body.rule : null);
        if (!rule || !rule.kind || typeof rule.kind !== 'string')
            return jsonError('Missing rule.kind', 400);
        next.rule = rule;
    }
    if (Object.keys(next).length === 0)
        return jsonError('No fields to update', 400);
    next.updatedAt = new Date();
    const db = getDb();
    const exists = await db.select({ key: metricsSegments.key }).from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
    if (!exists.length)
        return jsonError('Not found', 404);
    await db.update(metricsSegments).set(next).where(eq(metricsSegments.key, key));
    const rows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
    return NextResponse.json({ data: rows[0] });
}
export async function DELETE(request, ctx) {
    const gate = requireAdminOrService(request);
    if (!gate.ok)
        return gate.res;
    const key = String(ctx?.params?.key || '').trim();
    if (!key)
        return jsonError('Missing key', 400);
    const db = getDb();
    const exists = await db.select({ key: metricsSegments.key }).from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
    if (!exists.length)
        return jsonError('Not found', 404);
    await db.delete(metricsSegments).where(eq(metricsSegments.key, key));
    return new NextResponse(null, { status: 204 });
}
