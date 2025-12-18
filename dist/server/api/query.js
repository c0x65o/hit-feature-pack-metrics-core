import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
export async function POST(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const metricKey = typeof body.metricKey === 'string' ? body.metricKey.trim() : '';
    if (!metricKey)
        return jsonError('Missing metricKey', 400);
    const start = new Date(body.start);
    const end = new Date(body.end);
    if (Number.isNaN(start.getTime()))
        return jsonError('Invalid start', 400);
    if (Number.isNaN(end.getTime()))
        return jsonError('Invalid end', 400);
    if (end <= start)
        return jsonError('end must be after start', 400);
    const bucket = body.bucket || 'day';
    if (!['hour', 'day', 'week', 'month'].includes(bucket))
        return jsonError(`Invalid bucket: ${bucket}`, 400);
    const agg = body.agg || 'sum';
    if (!['sum', 'avg', 'min', 'max', 'count'].includes(agg))
        return jsonError(`Invalid agg: ${agg}`, 400);
    const groupBy = Array.isArray(body.groupBy) ? body.groupBy : [];
    for (const k of groupBy) {
        if (typeof k !== 'string' || !/^[a-zA-Z0-9_]+$/.test(k))
            return jsonError(`Invalid groupBy key: ${String(k)}`, 400);
    }
    const whereParts = [
        eq(metricsMetricPoints.metricKey, metricKey),
        gte(metricsMetricPoints.date, start),
        lte(metricsMetricPoints.date, end),
    ];
    if (typeof body.entityKind === 'string' && body.entityKind.trim()) {
        whereParts.push(eq(metricsMetricPoints.entityKind, body.entityKind.trim()));
    }
    if (typeof body.entityId === 'string' && body.entityId.trim()) {
        whereParts.push(eq(metricsMetricPoints.entityId, body.entityId.trim()));
    }
    if (typeof body.dataSourceId === 'string' && body.dataSourceId.trim()) {
        whereParts.push(eq(metricsMetricPoints.dataSourceId, body.dataSourceId.trim()));
    }
    if (typeof body.sourceGranularity === 'string' && body.sourceGranularity.trim()) {
        whereParts.push(eq(metricsMetricPoints.granularity, body.sourceGranularity.trim()));
    }
    const dimFilters = body.dimensions && typeof body.dimensions === 'object' ? body.dimensions : null;
    if (dimFilters) {
        for (const [k, v] of Object.entries(dimFilters)) {
            if (!/^[a-zA-Z0-9_]+$/.test(k))
                return jsonError(`Invalid dimensions filter key: ${k}`, 400);
            if (v === null) {
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} is null`);
            }
            else {
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} = ${String(v)}`);
            }
        }
    }
    const bucketExpr = sql `date_trunc(${bucket}, ${metricsMetricPoints.date})`.as('bucket');
    const aggExpr = agg === 'sum'
        ? sql `sum(${metricsMetricPoints.value})`
        : agg === 'avg'
            ? sql `avg(${metricsMetricPoints.value})`
            : agg === 'min'
                ? sql `min(${metricsMetricPoints.value})`
                : agg === 'max'
                    ? sql `max(${metricsMetricPoints.value})`
                    : sql `count(*)`;
    const aggAliased = aggExpr.as('value');
    const groupExprs = groupBy.map((k) => sql `${metricsMetricPoints.dimensions} ->> ${k}`.as(k));
    const db = getDb();
    const rows = await db
        .select({
        bucket: bucketExpr,
        value: aggAliased,
        ...Object.fromEntries(groupBy.map((k, idx) => [k, groupExprs[idx]])),
    })
        .from(metricsMetricPoints)
        .where(and(...whereParts))
        .groupBy(bucketExpr, ...groupExprs)
        .orderBy(bucketExpr);
    return NextResponse.json({
        data: rows,
        meta: {
            metricKey,
            start: start.toISOString(),
            end: end.toISOString(),
            bucket,
            agg,
            groupBy,
        },
    });
}
