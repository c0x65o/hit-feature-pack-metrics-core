import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { computeDimensionsHash } from '../lib/dimensions';
import { sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const METRIC_POINT_UPSERT_CHUNK_SIZE = 400;
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
export async function POST(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const body = (await request.json().catch(() => null));
    if (!body || !Array.isArray(body.points))
        return jsonError('Body must include points: []', 400);
    const now = new Date();
    const values = [];
    for (const p of body.points) {
        if (!p || typeof p !== 'object')
            continue;
        if (!p.entityKind || !p.entityId || !p.metricKey || !p.dataSourceId || !p.date)
            continue;
        const d = new Date(p.date);
        if (Number.isNaN(d.getTime()))
            continue;
        const dimensions = p.dimensions && typeof p.dimensions === 'object' ? p.dimensions : null;
        const dimensionsHash = computeDimensionsHash(dimensions);
        values.push({
            id: `mp_${cryptoRandomId()}`,
            entityKind: String(p.entityKind),
            entityId: String(p.entityId),
            metricKey: String(p.metricKey),
            dataSourceId: String(p.dataSourceId),
            syncRunId: p.syncRunId ? String(p.syncRunId) : null,
            ingestBatchId: p.ingestBatchId ? String(p.ingestBatchId) : null,
            date: d,
            granularity: p.granularity ? String(p.granularity) : 'daily',
            value: String(p.value),
            dimensions,
            dimensionsHash,
            createdAt: now,
            updatedAt: now,
        });
    }
    if (values.length === 0)
        return jsonError('No valid points provided', 400);
    const db = getDb();
    // Upsert via unique constraint (dataSourceId, metricKey, date, granularity, dimensionsHash).
    // On conflict we update value + provenance + updatedAt.
    // Batch upserts to avoid extremely large parameterized statements which can trigger
    // node-postgres/extended-protocol edge cases (e.g. "bind message has N parameter formats but 0 parameters").
    for (let i = 0; i < values.length; i += METRIC_POINT_UPSERT_CHUNK_SIZE) {
        const chunk = values.slice(i, i + METRIC_POINT_UPSERT_CHUNK_SIZE);
        await db
            .insert(metricsMetricPoints)
            .values(chunk)
            .onConflictDoUpdate({
            target: [
                metricsMetricPoints.dataSourceId,
                metricsMetricPoints.metricKey,
                metricsMetricPoints.date,
                metricsMetricPoints.granularity,
                metricsMetricPoints.dimensionsHash,
            ],
            set: {
                value: sql `excluded.value`,
                syncRunId: sql `excluded.sync_run_id`,
                ingestBatchId: sql `excluded.ingest_batch_id`,
                updatedAt: now,
            },
        });
    }
    return NextResponse.json({ success: true, received: body.points.length, ingested: values.length });
}
function cryptoRandomId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
