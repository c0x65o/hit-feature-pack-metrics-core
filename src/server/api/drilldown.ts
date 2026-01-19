import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { getAuthContext, checkMetricPermissions } from '../lib/authz';
import { drilldownSchema } from './drilldown.schema';
import { getAppReportTimezone } from '../lib/reporting';
import { tryRunComputedMetricDrilldown, type QueryBody as ComputedQueryBody } from '../lib/computed-metrics';
import { loadCompiledMetricsCatalog } from '../lib/compiled-catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export { drilldownSchema } from './drilldown.schema';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';

async function loadCatalogEntry(metricKey: string): Promise<any | null> {
  const cat = await loadCompiledMetricsCatalog();
  const e = (cat as any)?.[metricKey];
  return e && typeof e === 'object' ? e : null;
}

function parseOptionalDate(label: string, raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${label}`);
  return d;
}

function addBucketEnd(start: Date, bucket: Bucket): Date {
  const d = new Date(start.getTime());
  if (bucket === 'hour') return new Date(d.getTime() + 60 * 60 * 1000);
  if (bucket === 'day') return new Date(d.getTime() + 24 * 60 * 60 * 1000);
  if (bucket === 'week') return new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (bucket === 'month') {
    // Use UTC month increment to avoid DST edge cases.
    const out = new Date(d.getTime());
    out.setUTCMonth(out.getUTCMonth() + 1);
    return out;
  }
  return d;
}

function buildWhereFromPointFilter(filter: any) {
  const metricKey = String(filter.metricKey || '').trim();
  if (!metricKey) throw new Error('Missing metricKey');

  const start = parseOptionalDate('start', filter.start);
  const end = parseOptionalDate('end', filter.end);
  if (start && end && end <= start) throw new Error('end must be after start');

  const entityKind = typeof filter.entityKind === 'string' ? filter.entityKind.trim() : '';
  const entityId = typeof filter.entityId === 'string' ? filter.entityId.trim() : '';
  const entityIds = Array.isArray(filter.entityIds) ? filter.entityIds.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
  const dataSourceId = typeof filter.dataSourceId === 'string' ? filter.dataSourceId.trim() : '';
  const sourceGranularity = typeof filter.sourceGranularity === 'string' ? filter.sourceGranularity.trim() : '';
  const params = filter.params && typeof filter.params === 'object' ? filter.params : null;
  const dimensions = filter.dimensions && typeof filter.dimensions === 'object' ? filter.dimensions : null;

  const whereParts: any[] = [eq(metricsMetricPoints.metricKey, metricKey)];
  if (start) whereParts.push(gte(metricsMetricPoints.date, start));
  if (end) whereParts.push(lte(metricsMetricPoints.date, end));
  if (entityKind) whereParts.push(eq(metricsMetricPoints.entityKind, entityKind));
  if (entityId) whereParts.push(eq(metricsMetricPoints.entityId, entityId));
  if (entityIds.length) {
    if (entityIds.length > 1000) throw new Error('Too many entityIds (max 1000)');
    whereParts.push(inArray(metricsMetricPoints.entityId as any, entityIds as any));
  }
  if (dataSourceId) whereParts.push(eq(metricsMetricPoints.dataSourceId, dataSourceId));
  if (sourceGranularity) whereParts.push(eq(metricsMetricPoints.granularity, sourceGranularity));

  if (dimensions) {
    for (const [k, v] of Object.entries(dimensions)) {
      if (!/^[a-zA-Z0-9_]+$/.test(k)) throw new Error(`Invalid dimensions key: ${k}`);
      if (v === null) whereParts.push(sql`${metricsMetricPoints.dimensions} ->> ${k} is null`);
      else whereParts.push(sql`${metricsMetricPoints.dimensions} ->> ${k} = ${String(v)}`);
    }
  }

  return {
    metricKey,
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null,
    entityKind: entityKind || null,
    entityId: entityId || null,
    entityIds,
    dataSourceId: dataSourceId || null,
    sourceGranularity: sourceGranularity || null,
    params: params || null,
    dimensions: dimensions || null,
    where: and(...whereParts),
  };
}

function derivePointFilterFromAggregate(input: { baseQuery: any; rowContext: any }) {
  const base = input.baseQuery;
  const row = input.rowContext || {};

  const metricKey = String(base.metricKey || '').trim();
  if (!metricKey) throw new Error('Missing baseQuery.metricKey');

  const bucket: Bucket = (base.bucket || 'day') as Bucket;
  const agg = String(base.agg || 'sum');

  // Start/end from base, optionally narrowed to the clicked bucket.
  const baseStart = parseOptionalDate('start', base.start);
  const baseEnd = parseOptionalDate('end', base.end);
  if (baseStart && baseEnd && baseEnd <= baseStart) throw new Error('end must be after start');

  let start = baseStart;
  let end = baseEnd;
  const rowBucket = typeof row.bucket === 'string' ? row.bucket.trim() : '';
  if (bucket !== 'none' && rowBucket) {
    const bs = new Date(rowBucket);
    if (Number.isNaN(bs.getTime())) throw new Error('Invalid rowContext.bucket');
    start = bs;
    end = addBucketEnd(bs, bucket);
  }

  const entityKind = typeof base.entityKind === 'string' ? base.entityKind.trim() : '';

  const groupByEntityId = Boolean(base.groupByEntityId);
  const rowEntityId = typeof row.entityId === 'string' ? row.entityId.trim() : '';
  const entityId = groupByEntityId ? rowEntityId : (typeof base.entityId === 'string' ? base.entityId.trim() : '');
  if (groupByEntityId && !entityId) throw new Error('Missing rowContext.entityId for groupByEntityId drilldown');

  const entityIds = Array.isArray(base.entityIds) ? base.entityIds.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
  const dataSourceId = typeof base.dataSourceId === 'string' ? base.dataSourceId.trim() : '';
  const sourceGranularity = typeof base.sourceGranularity === 'string' ? base.sourceGranularity.trim() : '';
  const params = base.params && typeof base.params === 'object' ? base.params : null;

  // Dimensions: start from base.dimensions (filters), then add rowContext.dimensions (group values).
  const dims: Record<string, any> = {};
  if (base.dimensions && typeof base.dimensions === 'object') Object.assign(dims, base.dimensions);

  const groupBy = Array.isArray(base.groupBy) ? base.groupBy : [];
  const rowDims = row.dimensions && typeof row.dimensions === 'object' ? row.dimensions : null;
  if (groupBy.length) {
    if (!rowDims) throw new Error('Missing rowContext.dimensions for groupBy drilldown');
    for (const k of groupBy) {
      if (typeof k !== 'string' || !/^[a-zA-Z0-9_]+$/.test(k)) throw new Error(`Invalid groupBy key: ${String(k)}`);
      if (!(k in rowDims)) throw new Error(`rowContext.dimensions missing groupBy key: ${k}`);
      dims[k] = (rowDims as any)[k];
    }
  }

  // For agg=last, the drilldown should still be point-based; UI can decide whether to show 1 row or a small history.
  // We expose agg so the client can label it correctly.
  return {
    pointFilter: {
      metricKey,
      start: start ? start.toISOString() : undefined,
      end: end ? end.toISOString() : undefined,
      entityKind: entityKind || undefined,
      entityId: entityId || undefined,
      entityIds: entityIds.length ? entityIds : undefined,
      dataSourceId: dataSourceId || undefined,
      sourceGranularity: sourceGranularity || undefined,
      params: params || undefined,
      dimensions: Object.keys(dims).length ? dims : undefined,
    },
    meta: {
      bucket,
      agg,
      rowBucket: rowBucket || null,
      groupBy,
      groupByEntityId,
    },
  };
}

export async function POST(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return jsonError('Unauthorized', 401);

  const reportTimezone = await getAppReportTimezone();

  const raw = await request.json().catch(() => null);
  const parsed = drilldownSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.message, 400);
  const body = parsed.data;

  if (!body.pointFilter && !(body.baseQuery && body.rowContext)) {
    return jsonError('Provide either pointFilter, or baseQuery + rowContext', 400);
  }

  let resolvedPointFilter: any;
  let deriveMeta: any = null;
  try {
    if (body.pointFilter) {
      resolvedPointFilter = body.pointFilter;
    } else {
      const derived = derivePointFilterFromAggregate({ baseQuery: body.baseQuery, rowContext: body.rowContext });
      resolvedPointFilter = derived.pointFilter;
      deriveMeta = derived.meta;
    }
  } catch (e: any) {
    return jsonError(e?.message || 'Invalid drilldown request', 400);
  }

  // FAIL CLOSED: check if user can read this metric
  const metricKey = String(resolvedPointFilter?.metricKey || '').trim();
  if (!metricKey) return jsonError('Missing metricKey', 400);
  const permissions = await checkMetricPermissions(request, [metricKey]);
  if (!permissions[metricKey]) {
    return jsonError(`Forbidden: you do not have permission to read metric '${metricKey}'.`, 403);
  }

  // Computed metrics fallback (no stored points).
  // If we don't have points for this metricKey, let computed-metrics return "point-like" rows for drilldown.
  try {
    const db = getDb();
    const hasPoint = await db
      .select({ one: sql<number>`1`.as('one') })
      .from(metricsMetricPoints as any)
      .where(eq((metricsMetricPoints as any).metricKey, metricKey))
      .limit(1);
    if (!hasPoint.length) {
      const catalogEntry = await loadCatalogEntry(metricKey);
      const computed = await tryRunComputedMetricDrilldown({
        db,
        pointFilter: resolvedPointFilter as unknown as ComputedQueryBody,
        page: body.page,
        pageSize: body.pageSize,
        catalogEntry: catalogEntry || undefined,
        request,
      });
      if (computed) {
        if (!computed.ok) return jsonError(computed.error, 400);
        return NextResponse.json({
          meta: {
            derivedFrom: deriveMeta,
            resolvedPointFilter: resolvedPointFilter,
            reportTimezone,
            computed: true,
            computedMeta: computed.meta,
          },
          pagination: computed.pagination,
          points: computed.points,
          contributors: null,
        });
      }
    }
  } catch {
    // fall through to points path
  }

  let whereBuilt: ReturnType<typeof buildWhereFromPointFilter>;
  try {
    whereBuilt = buildWhereFromPointFilter(resolvedPointFilter);
  } catch (e: any) {
    return jsonError(e?.message || 'Invalid point filter', 400);
  }

  const page = body.page;
  const pageSize = body.pageSize;
  const offset = (page - 1) * pageSize;

  const db = getDb();

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int`.as('total') })
    .from(metricsMetricPoints)
    .where(whereBuilt.where);

  const points = await db
    .select({
      id: metricsMetricPoints.id,
      metricKey: metricsMetricPoints.metricKey,
      entityKind: metricsMetricPoints.entityKind,
      entityId: metricsMetricPoints.entityId,
      dataSourceId: metricsMetricPoints.dataSourceId,
      syncRunId: metricsMetricPoints.syncRunId,
      ingestBatchId: metricsMetricPoints.ingestBatchId,
      date: metricsMetricPoints.date,
      granularity: metricsMetricPoints.granularity,
      value: metricsMetricPoints.value,
      dimensions: metricsMetricPoints.dimensions,
      createdAt: metricsMetricPoints.createdAt,
      updatedAt: metricsMetricPoints.updatedAt,
    })
    .from(metricsMetricPoints)
    .where(whereBuilt.where)
    .orderBy(desc(metricsMetricPoints.date), desc(metricsMetricPoints.id))
    .limit(pageSize)
    .offset(offset);

  let contributors: any = null;
  if (body.includeContributors) {
    // Sum/value aggregation for contributor breakdowns.
    // NOTE: metricsMetricPoints.value is numeric; we cast to float8 for ordering safety.
    const valueSum = sql<number>`sum(${metricsMetricPoints.value})::float8`.as('valueSum');
    const pointCount = sql<number>`count(*)::int`.as('pointCount');

    const byEntity = await db
      .select({
        entityId: metricsMetricPoints.entityId,
        valueSum,
        pointCount,
      })
      .from(metricsMetricPoints)
      .where(whereBuilt.where)
      .groupBy(metricsMetricPoints.entityId)
      .orderBy(desc(valueSum))
      .limit(20);

    const byDataSource = await db
      .select({
        dataSourceId: metricsMetricPoints.dataSourceId,
        valueSum,
        pointCount,
      })
      .from(metricsMetricPoints)
      .where(whereBuilt.where)
      .groupBy(metricsMetricPoints.dataSourceId)
      .orderBy(desc(valueSum))
      .limit(20);

    // Optional dimension contributor: only if we have a declared groupBy (from deriveMeta) or a single dimension filter key.
    let byDimension: any = null;
    const dimKey =
      Array.isArray(deriveMeta?.groupBy) && deriveMeta.groupBy.length
        ? String(deriveMeta.groupBy[0])
        : null;
    if (dimKey && /^[a-zA-Z0-9_]+$/.test(dimKey)) {
      const dimExpr = sql<string | null>`${metricsMetricPoints.dimensions} ->> ${dimKey}`.as(dimKey);
      const byDimRows = await db
        .select({
          key: dimExpr,
          valueSum,
          pointCount,
        })
        .from(metricsMetricPoints)
        .where(whereBuilt.where)
        .groupBy(dimExpr)
        .orderBy(desc(valueSum), asc(dimExpr))
        .limit(20);
      byDimension = { key: dimKey, rows: byDimRows };
    }

    contributors = { byEntity, byDataSource, byDimension };
  }

  return NextResponse.json({
    meta: {
      derivedFrom: deriveMeta,
      resolvedPointFilter: resolvedPointFilter,
      reportTimezone,
    },
    pagination: { page, pageSize, total: Number(total || 0) },
    points,
    contributors,
  });
}

