import { NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, lte, sql, asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { getAuthContext, checkMetricPermissions } from '../lib/authz';
import { getAppReportTimezone } from '../lib/reporting';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { pointsQuerySchema } from './points.schema';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function parseMaybeDate(s) {
    if (!s)
        return null;
    const d = new Date(String(s));
    if (Number.isNaN(d.getTime()))
        return null;
    return d;
}
function parseDimensionsParam(raw) {
    if (!raw)
        return null;
    const txt = String(raw).trim();
    if (!txt)
        return null;
    try {
        const v = JSON.parse(txt);
        if (!v || typeof v !== 'object' || Array.isArray(v))
            return null;
        return v;
    }
    catch {
        return null;
    }
}
function parseEntityIdsParam(raw) {
    if (!raw)
        return [];
    // support either comma-separated or JSON array
    const txt = String(raw).trim();
    if (!txt)
        return [];
    if (txt.startsWith('[')) {
        try {
            const arr = JSON.parse(txt);
            if (Array.isArray(arr))
                return arr.map((x) => String(x || '').trim()).filter(Boolean);
        }
        catch {
            // ignore
        }
    }
    return txt.split(',').map((s) => s.trim()).filter(Boolean);
}
/**
 * GET /api/metrics/points
 *
 * Paged raw metric points listing for drilldown + exports.
 *
 * Query params:
 * - metricKey (required)
 * - start/end (optional ISO strings)
 * - entityKind/entityId/entityIds (optional; entityIds can be comma-separated or JSON array)
 * - dataSourceId (optional)
 * - dimensions (optional JSON object as string)
 * - page/pageSize/order
 */
export async function GET(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const reportTimezone = await getAppReportTimezone();
    const { searchParams } = new URL(request.url);
    const metricKey = String(searchParams.get('metricKey') || '').trim();
    if (!metricKey)
        return jsonError('Missing metricKey', 400);
    // FAIL CLOSED: check if user can read this metric
    const permissions = await checkMetricPermissions(request, [metricKey]);
    if (!permissions[metricKey]) {
        return jsonError(`Forbidden: you do not have permission to read metric '${metricKey}'.`, 403);
    }
    const start = parseMaybeDate(searchParams.get('start'));
    if (searchParams.get('start') && !start)
        return jsonError('Invalid start', 400);
    const end = parseMaybeDate(searchParams.get('end'));
    if (searchParams.get('end') && !end)
        return jsonError('Invalid end', 400);
    if (start && end && end <= start)
        return jsonError('end must be after start', 400);
    const entityKind = String(searchParams.get('entityKind') || '').trim();
    const entityId = String(searchParams.get('entityId') || '').trim();
    const entityIds = parseEntityIdsParam(searchParams.get('entityIds'));
    const dataSourceId = String(searchParams.get('dataSourceId') || '').trim();
    const dimensions = parseDimensionsParam(searchParams.get('dimensions'));
    if (searchParams.get('dimensions') && !dimensions)
        return jsonError('Invalid dimensions (must be JSON object)', 400);
    const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
    const pageSize = Math.max(1, Math.min(500, Number(searchParams.get('pageSize') || 50) || 50));
    const order = String(searchParams.get('order') || 'date_desc').toLowerCase();
    const orderBy = order === 'date_asc' ? asc(metricsMetricPoints.date) : desc(metricsMetricPoints.date);
    const whereParts = [eq(metricsMetricPoints.metricKey, metricKey)];
    if (start)
        whereParts.push(gte(metricsMetricPoints.date, start));
    if (end)
        whereParts.push(lte(metricsMetricPoints.date, end));
    if (entityKind)
        whereParts.push(eq(metricsMetricPoints.entityKind, entityKind));
    if (entityId)
        whereParts.push(eq(metricsMetricPoints.entityId, entityId));
    if (entityIds.length) {
        if (entityIds.length > 1000)
            return jsonError('Too many entityIds (max 1000)', 400);
        whereParts.push(inArray(metricsMetricPoints.entityId, entityIds));
    }
    if (dataSourceId)
        whereParts.push(eq(metricsMetricPoints.dataSourceId, dataSourceId));
    if (dimensions) {
        for (const [k, v] of Object.entries(dimensions)) {
            if (!/^[a-zA-Z0-9_]+$/.test(k))
                return jsonError(`Invalid dimensions key: ${k}`, 400);
            if (v === null)
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} is null`);
            else
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} = ${String(v)}`);
        }
    }
    const db = getDb();
    const where = and(...whereParts);
    const [{ total }] = await db
        .select({ total: sql `count(*)::int`.as('total') })
        .from(metricsMetricPoints)
        .where(where);
    const offset = (page - 1) * pageSize;
    const rows = await db
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
        .where(where)
        .orderBy(orderBy, desc(metricsMetricPoints.id))
        .limit(pageSize)
        .offset(offset);
    return NextResponse.json({
        meta: { reportTimezone },
        data: rows,
        pagination: { page, pageSize, total: Number(total || 0) },
    });
}
