import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsLinks } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { resolveMetricsCoreScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
export async function PUT(request, ctx) {
    const auth = getAuthContext(request);
    if (!auth || auth.kind !== 'user')
        return jsonError('Unauthorized', 401);
    // Resolve scope mode for write access
    const mode = await resolveMetricsCoreScopeMode(request, { verb: 'write', entity: 'mappings' });
    // Apply scope-based filtering (explicit branching on none/own/ldd/any)
    if (mode === 'none') {
        return jsonError('Forbidden', 403);
    }
    else if (mode === 'own' || mode === 'ldd') {
        // Metrics-core doesn't have ownership or LDD fields, so deny access
        return jsonError('Forbidden', 403);
    }
    else if (mode !== 'any') {
        // Fallback: deny access
        return jsonError('Forbidden', 403);
    }
    const id = ctx.params.id;
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const patch = {};
    if (typeof body.linkType === 'string')
        patch.linkType = body.linkType.trim();
    if (typeof body.linkId === 'string')
        patch.linkId = body.linkId.trim();
    if (typeof body.targetKind === 'string')
        patch.targetKind = body.targetKind.trim() || 'none';
    if (typeof body.targetId === 'string')
        patch.targetId = body.targetId.trim();
    if (typeof body.metadata === 'object')
        patch.metadata = body.metadata;
    patch.updatedAt = new Date();
    const db = getDb();
    const [updated] = await db.update(metricsLinks).set(patch).where(eq(metricsLinks.id, id)).returning();
    if (!updated)
        return jsonError('Not found', 404);
    return NextResponse.json({ data: updated });
}
export async function DELETE(request, ctx) {
    const auth = getAuthContext(request);
    if (!auth || auth.kind !== 'user')
        return jsonError('Unauthorized', 401);
    // Resolve scope mode for delete access
    const mode = await resolveMetricsCoreScopeMode(request, { verb: 'delete', entity: 'mappings' });
    // Apply scope-based filtering (explicit branching on none/own/ldd/any)
    if (mode === 'none') {
        return jsonError('Forbidden', 403);
    }
    else if (mode === 'own' || mode === 'ldd') {
        // Metrics-core doesn't have ownership or LDD fields, so deny access
        return jsonError('Forbidden', 403);
    }
    else if (mode !== 'any') {
        // Fallback: deny access
        return jsonError('Forbidden', 403);
    }
    const id = ctx.params.id;
    const db = getDb();
    await db.delete(metricsLinks).where(eq(metricsLinks.id, id));
    return NextResponse.json({ success: true });
}
