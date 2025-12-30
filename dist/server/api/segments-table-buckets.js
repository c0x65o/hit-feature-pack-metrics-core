import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints, metricsSegments } from '@/lib/feature-pack-schemas';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { authQuery } from '../lib/auth-db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function requireUserOrService(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return { ok: false, res: jsonError('Unauthorized', 401) };
    if (auth.kind === 'service')
        return { ok: true };
    return { ok: true };
}
function asNumber(x) {
    const n = typeof x === 'number' ? x : Number(x);
    return Number.isFinite(n) ? n : null;
}
function opSql(op, left, right) {
    if (op === '>=')
        return sql `${left} >= ${right}`;
    if (op === '>')
        return sql `${left} > ${right}`;
    if (op === '<=')
        return sql `${left} <= ${right}`;
    if (op === '<')
        return sql `${left} < ${right}`;
    if (op === '==')
        return sql `${left} = ${right}`;
    return sql `${left} != ${right}`;
}
function windowRange(window) {
    const w = typeof window === 'string' ? window : null;
    if (!w || w === 'all_time')
        return { start: null, end: null };
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    if (w === 'last_7_days')
        return { start: new Date(now.getTime() - 7 * dayMs), end: now };
    if (w === 'last_30_days')
        return { start: new Date(now.getTime() - 30 * dayMs), end: now };
    if (w === 'last_90_days')
        return { start: new Date(now.getTime() - 90 * dayMs), end: now };
    if (w === 'month_to_date') {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        return { start, end: now };
    }
    if (w === 'year_to_date') {
        const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        return { start, end: now };
    }
    return { start: null, end: null };
}
async function loadBucketSegments(args) {
    const { tableId, columnKey, entityKind } = args;
    const db = getDb();
    const where = [
        eq(metricsSegments.isActive, true),
        sql `(${metricsSegments.rule} -> 'table' ->> 'tableId') = ${tableId}`,
        sql `(${metricsSegments.rule} -> 'table' ->> 'columnKey') = ${columnKey}`,
    ];
    if (entityKind)
        where.push(eq(metricsSegments.entityKind, entityKind));
    const rows = await db
        .select()
        .from(metricsSegments)
        .where(and(...where))
        .orderBy(asc(metricsSegments.key));
    const out = [];
    for (const r of rows) {
        const rule = (r?.rule && typeof r.rule === 'object' ? r.rule : null);
        const table = rule?.table && typeof rule.table === 'object' ? rule.table : null;
        const bucketLabel = typeof table?.bucketLabel === 'string' ? table.bucketLabel.trim() : '';
        const sortOrder = Number(table?.sortOrder ?? 0) || 0;
        const ck = typeof table?.columnKey === 'string' ? table.columnKey.trim() : '';
        if (!ck)
            continue;
        if (!bucketLabel)
            continue;
        out.push({
            segmentKey: String(r.key || '').trim(),
            bucketLabel,
            sortOrder,
            columnKey: ck,
            columnLabel: typeof table?.columnLabel === 'string' ? table.columnLabel.trim() : undefined,
            entityKind: typeof r?.entityKind === 'string' ? String(r.entityKind) : undefined,
            entityIdField: typeof table?.entityIdField === 'string' ? table.entityIdField.trim() : 'id',
        });
    }
    out.sort((a, b) => (a.sortOrder - b.sortOrder) || a.bucketLabel.localeCompare(b.bucketLabel) || a.segmentKey.localeCompare(b.segmentKey));
    return out;
}
async function loadBucketColumns(args) {
    const { tableId, entityKind } = args;
    const db = getDb();
    const where = [
        eq(metricsSegments.isActive, true),
        sql `(${metricsSegments.rule} -> 'table' ->> 'tableId') = ${tableId}`,
        sql `(${metricsSegments.rule} -> 'table' ->> 'columnKey') is not null`,
    ];
    if (entityKind)
        where.push(eq(metricsSegments.entityKind, entityKind));
    const rows = await db
        .select()
        .from(metricsSegments)
        .where(and(...where))
        .orderBy(asc(metricsSegments.key));
    const byColumn = new Map();
    for (const r of rows) {
        const rule = (r?.rule && typeof r.rule === 'object' ? r.rule : null);
        const table = rule?.table && typeof rule.table === 'object' ? rule.table : null;
        const ck = typeof table?.columnKey === 'string' ? table.columnKey.trim() : '';
        if (!ck)
            continue;
        const bucketLabel = typeof table?.bucketLabel === 'string' ? table.bucketLabel.trim() : '';
        if (!bucketLabel)
            continue;
        const sortOrder = Number(table?.sortOrder ?? 0) || 0;
        const columnLabel = typeof table?.columnLabel === 'string' ? table.columnLabel.trim() : null;
        const ek = typeof r?.entityKind === 'string' ? String(r.entityKind) : null;
        const entityIdField = typeof table?.entityIdField === 'string' ? table.entityIdField.trim() : 'id';
        if (!byColumn.has(ck)) {
            byColumn.set(ck, { columnKey: ck, columnLabel, entityKind: ek, entityIdField, buckets: [] });
        }
        const col = byColumn.get(ck);
        if (!col.columnLabel && columnLabel)
            col.columnLabel = columnLabel;
        if (!col.entityKind && ek)
            col.entityKind = ek;
        // If multiple segments specify different entityIdField, keep the first.
        col.buckets.push({ segmentKey: String(r.key || '').trim(), bucketLabel, sortOrder });
    }
    const columns = Array.from(byColumn.values()).map((c) => {
        c.buckets.sort((a, b) => (a.sortOrder - b.sortOrder) || a.bucketLabel.localeCompare(b.bucketLabel) || a.segmentKey.localeCompare(b.segmentKey));
        return c;
    }).sort((a, b) => a.columnKey.localeCompare(b.columnKey));
    return columns;
}
async function queryMembersForSegment(args) {
    const { segmentKey, entityKind, page, pageSize } = args;
    const db = getDb();
    const segRows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, segmentKey)).limit(1);
    if (!segRows.length)
        return { ok: false, error: 'Segment not found' };
    const seg = segRows[0];
    if (seg.entityKind !== entityKind)
        return { ok: false, error: `Segment entityKind mismatch (segment=${seg.entityKind}, request=${entityKind})` };
    if (seg.isActive === false)
        return { ok: true, items: [], total: 0 };
    const rule = (seg.rule && typeof seg.rule === 'object' ? seg.rule : null);
    if (!rule || typeof rule.kind !== 'string')
        return { ok: false, error: 'Segment rule is invalid' };
    if (rule.kind === 'all_entities') {
        if (entityKind !== 'user')
            return { ok: false, error: `all_entities only supports entityKind=user (got ${entityKind})` };
        const totalRows = await authQuery('select count(*)::text as count from hit_auth_users', []);
        const total = totalRows.length ? Number(totalRows[0].count || 0) : 0;
        const offset = (page - 1) * pageSize;
        const itemsRows = await authQuery(`select email from hit_auth_users order by email asc limit ${pageSize} offset ${offset}`, []);
        const items = itemsRows.map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean);
        return { ok: true, items, total: Number.isFinite(total) ? total : 0 };
    }
    if (rule.kind === 'static_entity_ids') {
        const ids = Array.isArray(rule.entityIds)
            ? rule.entityIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const total = ids.length;
        const startIdx = (page - 1) * pageSize;
        const items = ids.slice(startIdx, startIdx + pageSize);
        return { ok: true, items, total };
    }
    if (rule.kind === 'metric_threshold') {
        const r = rule;
        const metricKey = String(r.metricKey || '').trim();
        if (!metricKey)
            return { ok: false, error: 'Missing rule.metricKey' };
        let start = null;
        let end = null;
        if (r.start) {
            start = new Date(r.start);
            if (Number.isNaN(start.getTime()))
                return { ok: false, error: 'Invalid rule.start' };
        }
        if (r.end) {
            end = new Date(r.end);
            if (Number.isNaN(end.getTime()))
                return { ok: false, error: 'Invalid rule.end' };
        }
        if (!start && !end && r.window) {
            const wr = windowRange(r.window);
            start = wr.start;
            end = wr.end;
        }
        if (start && end && end <= start)
            return { ok: false, error: 'rule.end must be after rule.start' };
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
            return { ok: false, error: 'Invalid rule.value' };
        if (agg === 'last') {
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
            const latest = db
                .select({ entityId: base.entityId, value: base.value })
                .from(base)
                .where(eq(base.rn, 1))
                .as('latest');
            const whereMatch = opSql(op, sql `${latest.value}::float8`, threshold);
            const countRows = await db
                .select({ count: sql `count(*)`.as('count') })
                .from(latest)
                .where(whereMatch);
            const total = Number(countRows?.[0]?.count || 0) || 0;
            const rows = await db
                .select({ entityId: latest.entityId })
                .from(latest)
                .where(whereMatch)
                .orderBy(asc(latest.entityId))
                .limit(pageSize)
                .offset((page - 1) * pageSize);
            const items = rows.map((row) => String(row.entityId));
            return { ok: true, items, total };
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
        const having = opSql(op, sql `${aggExpr}::float8`, threshold);
        const matched = db
            .select({ entityId: metricsMetricPoints.entityId })
            .from(metricsMetricPoints)
            .where(and(...whereParts))
            .groupBy(metricsMetricPoints.entityId)
            .having(having)
            .as('matched');
        const countRows = await db
            .select({ count: sql `count(*)`.as('count') })
            .from(matched);
        const total = Number(countRows?.[0]?.count || 0) || 0;
        const rows = await db
            .select({ entityId: matched.entityId })
            .from(matched)
            .orderBy(asc(matched.entityId))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        const items = rows.map((row) => String(row.entityId));
        return { ok: true, items, total };
    }
    if (rule.kind === 'entity_attribute') {
        if (entityKind !== 'user')
            return { ok: false, error: `entity_attribute only supports entityKind=user (got ${entityKind})` };
        const r = rule;
        const attr = String(r.attribute || '').trim();
        const op = r.op === '!=' ? '!=' : '==';
        const v = r.value;
        let whereSql = 'true';
        const params = [];
        if (attr === 'role') {
            if (typeof v !== 'string' || !v.trim())
                return { ok: false, error: 'Invalid rule.value (role)' };
            params.push(v.trim());
            whereSql = op === '==' ? `role = $${params.length}` : `role <> $${params.length}`;
        }
        else if (attr === 'email_verified') {
            const b = Boolean(v);
            params.push(b);
            whereSql = op === '==' ? `email_verified = $${params.length}` : `email_verified <> $${params.length}`;
        }
        else if (attr === 'locked') {
            const b = Boolean(v);
            params.push(b);
            whereSql = op === '==' ? `locked = $${params.length}` : `locked <> $${params.length}`;
        }
        else {
            return { ok: false, error: `Unsupported attribute: ${attr}` };
        }
        const totalRows = await authQuery(`select count(*)::text as count from hit_auth_users where ${whereSql}`, params);
        const total = totalRows.length ? Number(totalRows[0].count || 0) : 0;
        const offset = (page - 1) * pageSize;
        const itemsRows = await authQuery(`select email from hit_auth_users where ${whereSql} order by email asc limit ${pageSize} offset ${offset}`, params);
        const items = itemsRows.map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean);
        return { ok: true, items, total: Number.isFinite(total) ? total : 0 };
    }
    return { ok: false, error: `Unsupported rule kind: ${rule.kind}` };
}
/**
 * GET /api/metrics/segments/table-buckets?tableId=projects&columnKey=revenue_bucket&entityKind=project
 *
 * Lists bucket segments (definitions) linked to a given tableId+columnKey.
 */
export async function GET(request) {
    const gate = requireUserOrService(request);
    if (!gate.ok)
        return gate.res;
    const url = new URL(request.url);
    const tableId = String(url.searchParams.get('tableId') || '').trim();
    const columnKey = String(url.searchParams.get('columnKey') || '').trim();
    const entityKind = String(url.searchParams.get('entityKind') || '').trim();
    if (!tableId)
        return jsonError('Missing tableId', 400);
    if (!columnKey) {
        const columns = await loadBucketColumns({ tableId, entityKind: entityKind || undefined });
        return NextResponse.json({ data: { tableId, entityKind: entityKind || null, columns } });
    }
    const buckets = await loadBucketSegments({ tableId, columnKey, entityKind: entityKind || undefined });
    const columnLabel = buckets.find((b) => b.columnLabel)?.columnLabel;
    const entityIdField = buckets.find((b) => b.entityIdField)?.entityIdField || 'id';
    const ek = buckets.find((b) => b.entityKind)?.entityKind || (entityKind || null);
    return NextResponse.json({ data: { tableId, columnKey, columnLabel: columnLabel || null, entityKind: ek, entityIdField, buckets } });
}
/**
 * POST /api/metrics/segments/table-buckets/query
 *
 * Returns counts and a page of entityIds per bucket (server-side).
 *
 * Body:
 *  - tableId: string
 *  - columnKey: string
 *  - entityKind: string
 *  - pageSize?: number (per bucket)
 *  - bucketPages?: Record<segmentKey, pageNumber>  (per bucket)
 */
export async function POST(request) {
    const gate = requireUserOrService(request);
    if (!gate.ok)
        return gate.res;
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const tableId = typeof body.tableId === 'string' ? body.tableId.trim() : '';
    const columnKey = typeof body.columnKey === 'string' ? body.columnKey.trim() : '';
    const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
    const pageSize = Math.max(1, Math.min(500, Number(body.pageSize || 25) || 25));
    const bucketPagesRaw = (body.bucketPages && typeof body.bucketPages === 'object' ? body.bucketPages : null);
    if (!tableId)
        return jsonError('Missing tableId', 400);
    if (!columnKey)
        return jsonError('Missing columnKey', 400);
    if (!entityKind)
        return jsonError('Missing entityKind', 400);
    const buckets = await loadBucketSegments({ tableId, columnKey, entityKind });
    const out = [];
    for (const b of buckets) {
        const page = Math.max(1, Number(bucketPagesRaw?.[b.segmentKey] || 1) || 1);
        const res = await queryMembersForSegment({ segmentKey: b.segmentKey, entityKind, page, pageSize });
        if (!res.ok)
            return jsonError(`Bucket segment query failed (${b.segmentKey}): ${res.error}`, 400);
        out.push({
            bucketLabel: b.bucketLabel,
            sortOrder: b.sortOrder,
            segmentKey: b.segmentKey,
            page,
            pageSize,
            total: res.total,
            items: res.items,
        });
    }
    out.sort((a, b) => (a.sortOrder - b.sortOrder) || a.bucketLabel.localeCompare(b.bucketLabel) || a.segmentKey.localeCompare(b.segmentKey));
    return NextResponse.json({ data: { tableId, columnKey, entityKind, buckets: out } });
}
