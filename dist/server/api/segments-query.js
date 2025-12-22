import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints, metricsSegments } from '@/lib/feature-pack-schemas';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
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
function cmp(op, left, right) {
    if (op === '>=')
        return left >= right;
    if (op === '>')
        return left > right;
    if (op === '<=')
        return left <= right;
    if (op === '<')
        return left < right;
    if (op === '==')
        return left === right;
    return left !== right;
}
function asNumber(x) {
    const n = typeof x === 'number' ? x : Number(x);
    return Number.isFinite(n) ? n : null;
}
export async function POST(request) {
    const gate = requireAdminOrService(request);
    if (!gate.ok)
        return gate.res;
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const segmentKey = typeof body.segmentKey === 'string' ? body.segmentKey.trim() : '';
    const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
    const page = Math.max(1, Number(body.page || 1) || 1);
    const pageSize = Math.max(1, Math.min(500, Number(body.pageSize || 50) || 50));
    if (!segmentKey)
        return jsonError('Missing segmentKey', 400);
    if (!entityKind)
        return jsonError('Missing entityKind', 400);
    const db = getDb();
    const segRows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, segmentKey)).limit(1);
    if (!segRows.length)
        return jsonError('Segment not found', 404);
    const seg = segRows[0];
    if (seg.entityKind !== entityKind)
        return jsonError(`Segment entityKind mismatch (segment=${seg.entityKind}, request=${entityKind})`, 400);
    if (seg.isActive === false)
        return NextResponse.json({ data: { items: [], total: 0, page, pageSize } });
    const rule = (seg.rule && typeof seg.rule === 'object' ? seg.rule : null);
    if (!rule || typeof rule.kind !== 'string')
        return jsonError('Segment rule is invalid', 500);
    if (rule.kind === 'static_entity_ids') {
        const ids = Array.isArray(rule.entityIds)
            ? rule.entityIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const total = ids.length;
        const startIdx = (page - 1) * pageSize;
        const items = ids.slice(startIdx, startIdx + pageSize);
        return NextResponse.json({ data: { items, total, page, pageSize } });
    }
    if (rule.kind === 'metric_threshold') {
        const r = rule;
        const metricKey = String(r.metricKey || '').trim();
        if (!metricKey)
            return jsonError('Missing rule.metricKey', 400);
        let start = null;
        let end = null;
        if (r.start) {
            start = new Date(r.start);
            if (Number.isNaN(start.getTime()))
                return jsonError('Invalid rule.start', 400);
        }
        if (r.end) {
            end = new Date(r.end);
            if (Number.isNaN(end.getTime()))
                return jsonError('Invalid rule.end', 400);
        }
        if (start && end && end <= start)
            return jsonError('rule.end must be after rule.start', 400);
        const whereParts = [
            eq(metricsMetricPoints.entityKind, entityKind),
            eq(metricsMetricPoints.metricKey, metricKey),
        ];
        if (start)
            whereParts.push(gte(metricsMetricPoints.date, start));
        if (end)
            whereParts.push(lte(metricsMetricPoints.date, end));
        const agg = (r.agg || 'sum');
        const op = r.op;
        const threshold = asNumber(r.value);
        if (!threshold && threshold !== 0)
            return jsonError('Invalid rule.value', 400);
        // MVP approach: query aggregated value per entityId, then filter + paginate in memory.
        // This is acceptable for small/medium datasets; later we can push HAVING + LIMIT/OFFSET into SQL.
        if (agg === 'last') {
            // last-per-entity: use row_number partitioned by entity_id
            const rnExpr = sql `row_number() over (partition by ${metricsMetricPoints.entityId} order by ${metricsMetricPoints.date} desc)`.as('rn');
            const base = db
                .select({
                entityId: metricsMetricPoints.entityId,
                value: metricsMetricPoints.value,
                rn: rnExpr,
            })
                .from(metricsMetricPoints)
                .where(and(...whereParts))
                .as('mp');
            const rows = await db
                .select({ entityId: base.entityId, value: base.value })
                .from(base)
                .where(eq(base.rn, 1))
                .orderBy(asc(base.entityId));
            const matched = rows.filter((row) => {
                const v = asNumber(row.value) ?? 0;
                return cmp(op, v, threshold);
            });
            const total = matched.length;
            const startIdx = (page - 1) * pageSize;
            const items = matched.slice(startIdx, startIdx + pageSize).map((row) => String(row.entityId));
            return NextResponse.json({ data: { items, total, page, pageSize } });
        }
        const aggExpr = agg === 'sum'
            ? sql `sum(${metricsMetricPoints.value})`
            : agg === 'avg'
                ? sql `avg(${metricsMetricPoints.value})`
                : agg === 'min'
                    ? sql `min(${metricsMetricPoints.value})`
                    : agg === 'max'
                        ? sql `max(${metricsMetricPoints.value})`
                        : sql `count(*)`;
        const rows = await db
            .select({ entityId: metricsMetricPoints.entityId, value: aggExpr.as('value') })
            .from(metricsMetricPoints)
            .where(and(...whereParts))
            .groupBy(metricsMetricPoints.entityId)
            .orderBy(asc(metricsMetricPoints.entityId));
        const matched = rows.filter((row) => {
            const v = asNumber(row.value) ?? 0;
            return cmp(op, v, threshold);
        });
        const total = matched.length;
        const startIdx = (page - 1) * pageSize;
        const items = matched.slice(startIdx, startIdx + pageSize).map((row) => String(row.entityId));
        return NextResponse.json({ data: { items, total, page, pageSize } });
    }
    return jsonError(`Unsupported rule kind: ${rule.kind}`, 400);
}
