import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
async function runOne(db, body) {
    const metricKey = typeof body.metricKey === 'string' ? body.metricKey.trim() : '';
    if (!metricKey)
        return { error: 'Missing metricKey' };
    const bucket = body.bucket || 'day';
    if (!['none', 'hour', 'day', 'week', 'month'].includes(bucket))
        return { error: `Invalid bucket: ${bucket}` };
    let start = null;
    let end = null;
    if (bucket !== 'none') {
        if (!body.start || !body.end)
            return { error: 'Missing start/end' };
        start = new Date(body.start);
        end = new Date(body.end);
        if (Number.isNaN(start.getTime()))
            return { error: 'Invalid start' };
        if (Number.isNaN(end.getTime()))
            return { error: 'Invalid end' };
        if (end <= start)
            return { error: 'end must be after start' };
    }
    else {
        if (body.start) {
            start = new Date(body.start);
            if (Number.isNaN(start.getTime()))
                return { error: 'Invalid start' };
        }
        if (body.end) {
            end = new Date(body.end);
            if (Number.isNaN(end.getTime()))
                return { error: 'Invalid end' };
        }
        if (start && end && end <= start)
            return { error: 'end must be after start' };
    }
    const agg = body.agg || 'sum';
    if (!['sum', 'avg', 'min', 'max', 'count', 'last'].includes(agg))
        return { error: `Invalid agg: ${agg}` };
    const groupBy = Array.isArray(body.groupBy) ? body.groupBy : [];
    for (const k of groupBy) {
        if (typeof k !== 'string' || !/^[a-zA-Z0-9_]+$/.test(k))
            return { error: `Invalid groupBy key: ${String(k)}` };
    }
    const whereParts = [eq(metricsMetricPoints.metricKey, metricKey)];
    if (start)
        whereParts.push(gte(metricsMetricPoints.date, start));
    if (end)
        whereParts.push(lte(metricsMetricPoints.date, end));
    if (typeof body.entityKind === 'string' && body.entityKind.trim()) {
        whereParts.push(eq(metricsMetricPoints.entityKind, body.entityKind.trim()));
    }
    if (typeof body.entityId === 'string' && body.entityId.trim()) {
        whereParts.push(eq(metricsMetricPoints.entityId, body.entityId.trim()));
    }
    const entityIds = Array.isArray(body.entityIds) ? body.entityIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
    if (entityIds.length > 0) {
        if (entityIds.length > 1000)
            return { error: 'Too many entityIds (max 1000)' };
        whereParts.push(inArray(metricsMetricPoints.entityId, entityIds));
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
                return { error: `Invalid dimensions filter key: ${k}` };
            if (v === null)
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} is null`);
            else
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} = ${String(v)}`);
        }
    }
    const groupByEntityId = Boolean(body.groupByEntityId);
    const isLast = agg === 'last';
    const aggExpr = agg === 'sum'
        ? sql `sum(${metricsMetricPoints.value})`
        : agg === 'avg'
            ? sql `avg(${metricsMetricPoints.value})`
            : agg === 'min'
                ? sql `min(${metricsMetricPoints.value})`
                : agg === 'max'
                    ? sql `max(${metricsMetricPoints.value})`
                    : sql `count(*)`;
    const groupExprs = groupBy.map((k) => sql `${metricsMetricPoints.dimensions} ->> ${k}`.as(k));
    const selectShape = {
        value: isLast ? metricsMetricPoints.value : aggExpr.as('value'),
        ...Object.fromEntries(groupBy.map((k, idx) => [k, groupExprs[idx]])),
    };
    const groupByExprs = [...groupExprs];
    const orderByExprs = [];
    if (groupByEntityId) {
        selectShape.entityId = metricsMetricPoints.entityId;
        groupByExprs.unshift(metricsMetricPoints.entityId);
    }
    if (bucket !== 'none') {
        const bucketExpr = sql `date_trunc(${bucket}, ${metricsMetricPoints.date})`.as('bucket');
        selectShape.bucket = bucketExpr;
        groupByExprs.unshift(bucketExpr);
        orderByExprs.push(bucketExpr);
    }
    else {
        if (groupByEntityId)
            orderByExprs.push(metricsMetricPoints.entityId);
    }
    for (const ge of groupExprs)
        orderByExprs.push(ge);
    if (isLast) {
        const bucketExprRaw = bucket !== 'none' ? sql `date_trunc(${bucket}, ${metricsMetricPoints.date})` : null;
        const dimExprsRaw = groupBy.map((k) => sql `${metricsMetricPoints.dimensions} ->> ${k}`);
        const partitionExprs = [];
        if (bucketExprRaw)
            partitionExprs.push(bucketExprRaw);
        if (groupByEntityId)
            partitionExprs.push(metricsMetricPoints.entityId);
        for (const de of dimExprsRaw)
            partitionExprs.push(de);
        const rnExpr = partitionExprs.length > 0
            ? sql `row_number() over (partition by ${sql.join(partitionExprs, sql `, `)} order by ${metricsMetricPoints.date} desc)`.as('rn')
            : sql `row_number() over (order by ${metricsMetricPoints.date} desc)`.as('rn');
        const baseSelect = { value: metricsMetricPoints.value, rn: rnExpr };
        if (bucketExprRaw)
            baseSelect.bucket = bucketExprRaw.as('bucket');
        if (groupByEntityId)
            baseSelect.entityId = metricsMetricPoints.entityId;
        for (let i = 0; i < groupBy.length; i++)
            baseSelect[groupBy[i]] = dimExprsRaw[i].as(groupBy[i]);
        const base = db
            .select(baseSelect)
            .from(metricsMetricPoints)
            .where(and(...whereParts))
            .as('mp');
        const outSelect = { value: base.value };
        if (bucketExprRaw)
            outSelect.bucket = base.bucket;
        if (groupByEntityId)
            outSelect.entityId = base.entityId;
        for (const k of groupBy)
            outSelect[k] = base[k];
        const outOrder = [];
        if (bucketExprRaw)
            outOrder.push(asc(base.bucket));
        if (groupByEntityId)
            outOrder.push(asc(base.entityId));
        for (const k of groupBy)
            outOrder.push(asc(base[k]));
        const rows = await db.select(outSelect).from(base).where(eq(base.rn, 1)).orderBy(...outOrder);
        return {
            data: rows,
            meta: {
                metricKey,
                start: start ? start.toISOString() : null,
                end: end ? end.toISOString() : null,
                bucket,
                agg,
                groupBy,
                groupByEntityId,
            },
        };
    }
    const rows = await db.select(selectShape).from(metricsMetricPoints).where(and(...whereParts)).groupBy(...groupByExprs).orderBy(...orderByExprs);
    return {
        data: rows,
        meta: {
            metricKey,
            start: start ? start.toISOString() : null,
            end: end ? end.toISOString() : null,
            bucket,
            agg,
            groupBy,
            groupByEntityId,
        },
    };
}
export async function POST(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const body = (await request.json().catch(() => null));
    if (!body || !Array.isArray(body.queries))
        return jsonError('Invalid JSON body', 400);
    if (body.queries.length > 200)
        return jsonError('Too many queries (max 200)', 400);
    const db = getDb();
    const results = await Promise.all(body.queries.map(async (q) => {
        try {
            return await runOne(db, q);
        }
        catch (e) {
            return { error: e?.message || 'Query failed' };
        }
    }));
    return NextResponse.json({ results });
}
