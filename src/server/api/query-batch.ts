import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';
type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';

type QueryBody = {
  metricKey: string;
  start?: string;
  end?: string;
  bucket?: Bucket;
  agg?: Agg;
  entityKind?: string;
  entityId?: string;
  entityIds?: string[];
  dataSourceId?: string;
  sourceGranularity?: string;
  dimensions?: Record<string, string | number | boolean | null>;
  groupBy?: string[];
  groupByEntityId?: boolean;
};

type BatchBody = { queries: QueryBody[] };

async function runOne(db: ReturnType<typeof getDb>, body: QueryBody) {
  const metricKey = typeof body.metricKey === 'string' ? body.metricKey.trim() : '';
  if (!metricKey) return { error: 'Missing metricKey' };

  const bucket: Bucket = body.bucket || 'day';
  if (!['none', 'hour', 'day', 'week', 'month'].includes(bucket)) return { error: `Invalid bucket: ${bucket}` };

  let start: Date | null = null;
  let end: Date | null = null;
  if (bucket !== 'none') {
    if (!body.start || !body.end) return { error: 'Missing start/end' };
    start = new Date(body.start);
    end = new Date(body.end);
    if (Number.isNaN(start.getTime())) return { error: 'Invalid start' };
    if (Number.isNaN(end.getTime())) return { error: 'Invalid end' };
    if (end <= start) return { error: 'end must be after start' };
  } else {
    if (body.start) {
      start = new Date(body.start);
      if (Number.isNaN(start.getTime())) return { error: 'Invalid start' };
    }
    if (body.end) {
      end = new Date(body.end);
      if (Number.isNaN(end.getTime())) return { error: 'Invalid end' };
    }
    if (start && end && end <= start) return { error: 'end must be after start' };
  }

  const agg: Agg = body.agg || 'sum';
  if (!['sum', 'avg', 'min', 'max', 'count', 'last'].includes(agg)) return { error: `Invalid agg: ${agg}` };

  const groupBy = Array.isArray(body.groupBy) ? body.groupBy : [];
  for (const k of groupBy) {
    if (typeof k !== 'string' || !/^[a-zA-Z0-9_]+$/.test(k)) return { error: `Invalid groupBy key: ${String(k)}` };
  }

  const whereParts: any[] = [eq(metricsMetricPoints.metricKey, metricKey)];
  if (start) whereParts.push(gte(metricsMetricPoints.date, start));
  if (end) whereParts.push(lte(metricsMetricPoints.date, end));

  if (typeof body.entityKind === 'string' && body.entityKind.trim()) {
    whereParts.push(eq(metricsMetricPoints.entityKind, body.entityKind.trim()));
  }
  if (typeof body.entityId === 'string' && body.entityId.trim()) {
    whereParts.push(eq(metricsMetricPoints.entityId, body.entityId.trim()));
  }
  const entityIds = Array.isArray(body.entityIds) ? body.entityIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (entityIds.length > 0) {
    if (entityIds.length > 1000) return { error: 'Too many entityIds (max 1000)' };
    whereParts.push(inArray(metricsMetricPoints.entityId as any, entityIds as any));
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
      if (!/^[a-zA-Z0-9_]+$/.test(k)) return { error: `Invalid dimensions filter key: ${k}` };
      if (v === null) whereParts.push(sql`${metricsMetricPoints.dimensions} ->> ${k} is null`);
      else whereParts.push(sql`${metricsMetricPoints.dimensions} ->> ${k} = ${String(v)}`);
    }
  }

  const groupByEntityId = Boolean(body.groupByEntityId);
  const isLast = agg === 'last';
  const aggExpr =
    agg === 'sum'
      ? sql`sum(${metricsMetricPoints.value})`
      : agg === 'avg'
        ? sql`avg(${metricsMetricPoints.value})`
        : agg === 'min'
          ? sql`min(${metricsMetricPoints.value})`
          : agg === 'max'
            ? sql`max(${metricsMetricPoints.value})`
            : sql`count(*)`;

  const groupExprs = groupBy.map((k) => sql`${metricsMetricPoints.dimensions} ->> ${k}`.as(k));
  const selectShape: Record<string, unknown> = {
    value: isLast ? (metricsMetricPoints.value as any) : (aggExpr.as('value') as any),
    ...Object.fromEntries(groupBy.map((k, idx) => [k, groupExprs[idx]])),
  };
  const groupByExprs: any[] = [...groupExprs];
  const orderByExprs: any[] = [];
  if (groupByEntityId) {
    (selectShape as any).entityId = metricsMetricPoints.entityId;
    groupByExprs.unshift(metricsMetricPoints.entityId as any);
  }

  if (bucket !== 'none') {
    const bucketExpr = sql`date_trunc(${bucket}, ${metricsMetricPoints.date})`.as('bucket');
    (selectShape as any).bucket = bucketExpr as any;
    groupByExprs.unshift(bucketExpr as any);
    orderByExprs.push(bucketExpr as any);
  } else {
    if (groupByEntityId) orderByExprs.push(metricsMetricPoints.entityId as any);
  }
  for (const ge of groupExprs) orderByExprs.push(ge as any);

  if (isLast) {
    const bucketExprRaw = bucket !== 'none' ? sql`date_trunc(${bucket}, ${metricsMetricPoints.date})` : null;
    const dimExprsRaw = groupBy.map((k) => sql`${metricsMetricPoints.dimensions} ->> ${k}`);

    const partitionExprs: any[] = [];
    if (bucketExprRaw) partitionExprs.push(bucketExprRaw);
    if (groupByEntityId) partitionExprs.push(metricsMetricPoints.entityId as any);
    for (const de of dimExprsRaw) partitionExprs.push(de as any);

    const rnExpr =
      partitionExprs.length > 0
        ? sql<number>`row_number() over (partition by ${sql.join(partitionExprs, sql`, `)} order by ${metricsMetricPoints.date} desc)`.as('rn')
        : sql<number>`row_number() over (order by ${metricsMetricPoints.date} desc)`.as('rn');

    const baseSelect: Record<string, unknown> = { value: metricsMetricPoints.value as any, rn: rnExpr as any };
    if (bucketExprRaw) (baseSelect as any).bucket = bucketExprRaw.as('bucket');
    if (groupByEntityId) (baseSelect as any).entityId = metricsMetricPoints.entityId;
    for (let i = 0; i < groupBy.length; i++) (baseSelect as any)[groupBy[i]] = dimExprsRaw[i].as(groupBy[i]);

    const base = db
      .select(baseSelect as any)
      .from(metricsMetricPoints)
      .where(and(...whereParts))
      .as('mp');

    const outSelect: Record<string, unknown> = { value: (base as any).value };
    if (bucketExprRaw) (outSelect as any).bucket = (base as any).bucket;
    if (groupByEntityId) (outSelect as any).entityId = (base as any).entityId;
    for (const k of groupBy) (outSelect as any)[k] = (base as any)[k];

    const outOrder: any[] = [];
    if (bucketExprRaw) outOrder.push(asc((base as any).bucket));
    if (groupByEntityId) outOrder.push(asc((base as any).entityId));
    for (const k of groupBy) outOrder.push(asc((base as any)[k]));

    const rows = await db.select(outSelect as any).from(base as any).where(eq((base as any).rn, 1)).orderBy(...outOrder);
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

  const rows = await db.select(selectShape as any).from(metricsMetricPoints).where(and(...whereParts)).groupBy(...groupByExprs).orderBy(...orderByExprs);
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

export async function POST(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return jsonError('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as BatchBody | null;
  if (!body || !Array.isArray(body.queries)) return jsonError('Invalid JSON body', 400);
  if (body.queries.length > 200) return jsonError('Too many queries (max 200)', 400);

  const db = getDb();
  const results = await Promise.all(
    body.queries.map(async (q) => {
      try {
        return await runOne(db, q);
      } catch (e: any) {
        return { error: e?.message || 'Query failed' };
      }
    })
  );

  return NextResponse.json({ results });
}


