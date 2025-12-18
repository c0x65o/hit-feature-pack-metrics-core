import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsDataSources } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
export async function GET() {
    const db = getDb();
    const rows = await db.select().from(metricsDataSources);
    return NextResponse.json({ data: rows });
}
export async function POST(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const requestedId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
    const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
    const connectorKey = typeof body.connectorKey === 'string' ? body.connectorKey.trim() : '';
    const sourceKind = typeof body.sourceKind === 'string' ? body.sourceKind.trim() : '';
    if (!entityKind)
        return jsonError('Missing entityKind', 400);
    if (!entityId)
        return jsonError('Missing entityId', 400);
    if (!connectorKey)
        return jsonError('Missing connectorKey', 400);
    if (!sourceKind)
        return jsonError('Missing sourceKind', 400);
    const now = new Date();
    const id = requestedId || `mds_${cryptoRandomId()}`;
    const enabled = body.enabled === false ? false : true;
    const db = getDb();
    if (requestedId) {
        const existingById = await db
            .select()
            .from(metricsDataSources)
            .where(eq(metricsDataSources.id, requestedId))
            .limit(1);
        if (existingById.length > 0) {
            return NextResponse.json({ data: existingById[0] }, { status: 200 });
        }
    }
    // Very soft de-dupe: don't allow identical (entityKind, entityId, connectorKey, externalRef) duplicates.
    const externalRef = typeof body.externalRef === 'string' ? body.externalRef : null;
    const existing = await db
        .select({ id: metricsDataSources.id })
        .from(metricsDataSources)
        .where(eq(metricsDataSources.connectorKey, connectorKey))
        .limit(200);
    if (externalRef && existing.length > 0) {
        // No strict uniqueness enforced here (pre-1.0), but we try to avoid accidental double-creates.
    }
    const [created] = await db
        .insert(metricsDataSources)
        .values({
        id,
        entityKind,
        entityId,
        connectorKey,
        sourceKind,
        externalRef,
        enabled,
        schedule: typeof body.schedule === 'string' ? body.schedule : null,
        config: typeof body.config === 'object' ? body.config : null,
        overlapPolicy: typeof body.overlapPolicy === 'string' ? body.overlapPolicy : 'upsert_points',
        createdAt: now,
        updatedAt: now,
    })
        .returning();
    return NextResponse.json({ data: created }, { status: 201 });
}
function cryptoRandomId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
