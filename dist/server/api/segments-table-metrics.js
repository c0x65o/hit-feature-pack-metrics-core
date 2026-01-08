import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsLinks, metricsMetricPoints, metricsSegments } from '@/lib/feature-pack-schemas';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { getAuthContext, checkMetricPermissions, isAdminUser } from '../lib/authz';
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
function windowRange(window) {
    const w = typeof window === 'string' ? window : null;
    if (!w || w === 'all_time')
        return { start: null, end: null };
    // Normalize to UTC first
    const now = new Date();
    const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));
    const dayMs = 24 * 60 * 60 * 1000;
    if (w === 'last_7_days')
        return { start: new Date(nowUtc.getTime() - 7 * dayMs), end: nowUtc };
    if (w === 'last_30_days')
        return { start: new Date(nowUtc.getTime() - 30 * dayMs), end: nowUtc };
    if (w === 'last_90_days')
        return { start: new Date(nowUtc.getTime() - 90 * dayMs), end: nowUtc };
    if (w === 'month_to_date') {
        const start = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0));
        return { start, end: nowUtc };
    }
    if (w === 'year_to_date') {
        const start = new Date(Date.UTC(nowUtc.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        return { start, end: nowUtc };
    }
    return { start: null, end: null };
}
// NOTE:
// metrics-core builds in isolation, so we cannot depend on projects feature pack schemas at build time.
// We define the minimal shape needed for the "project revenue via steam_app_id dimension" fallback.
const projectsTable = pgTable('projects', {
    id: varchar('id', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
});
function parseMetricColumnFromSegmentRow(r) {
    const rule = (r?.rule && typeof r.rule === 'object' ? r.rule : null);
    if (!rule || String(rule.kind || '').trim() !== 'table_metric')
        return null;
    const table = rule?.table && typeof rule.table === 'object' ? rule.table : null;
    const columnKey = typeof table?.columnKey === 'string' ? table.columnKey.trim() : '';
    if (!columnKey)
        return null;
    const columnLabelRaw = typeof table?.columnLabel === 'string' ? table.columnLabel.trim() : '';
    const columnLabel = columnLabelRaw || columnKey;
    const entityIdField = typeof table?.entityIdField === 'string' && table.entityIdField.trim() ? table.entityIdField.trim() : 'id';
    const entityKind = typeof r?.entityKind === 'string' ? String(r.entityKind).trim() : null;
    const metricKey = typeof rule?.metricKey === 'string' ? rule.metricKey.trim() : '';
    if (!metricKey)
        return null;
    const aggRaw = typeof rule?.agg === 'string' ? rule.agg.trim() : '';
    const agg = aggRaw === 'avg' || aggRaw === 'min' || aggRaw === 'max' || aggRaw === 'count' || aggRaw === 'last' ? aggRaw : 'sum';
    const wRaw = typeof rule?.window === 'string' ? rule.window.trim() : '';
    const window = wRaw === 'last_7_days' || wRaw === 'last_30_days' || wRaw === 'last_90_days' || wRaw === 'month_to_date' || wRaw === 'year_to_date' || wRaw === 'all_time'
        ? wRaw
        : null;
    const sortOrder = Number(table?.sortOrder ?? 0) || 0;
    const format = typeof table?.format === 'string' && table.format.trim() ? table.format.trim() : null;
    const decimals = table?.decimals === null || table?.decimals === undefined ? null : Number(table.decimals);
    const dec = decimals === null ? null : (Number.isFinite(decimals) ? Math.max(0, Math.min(12, Math.floor(decimals))) : null);
    return {
        columnKey,
        columnLabel,
        entityKind,
        entityIdField,
        metricKey,
        agg,
        window,
        format,
        decimals: dec,
        sortOrder,
    };
}
async function loadMetricColumns(args) {
    const { tableId, entityKind } = args;
    const db = getDb();
    const where = [
        eq(metricsSegments.isActive, true),
        sql `(${metricsSegments.rule} ->> 'kind') = 'table_metric'`,
        sql `(${metricsSegments.rule} -> 'table' ->> 'tableId') = ${tableId}`,
        sql `(${metricsSegments.rule} -> 'table' ->> 'columnKey') is not null`,
    ];
    if (entityKind)
        where.push(eq(metricsSegments.entityKind, entityKind));
    const rows = await db.select().from(metricsSegments).where(and(...where)).orderBy(asc(metricsSegments.key));
    const out = [];
    for (const r of rows) {
        const def = parseMetricColumnFromSegmentRow(r);
        if (!def)
            continue;
        out.push(def);
    }
    out.sort((a, b) => (a.sortOrder - b.sortOrder) || a.columnLabel.localeCompare(b.columnLabel) || a.columnKey.localeCompare(b.columnKey));
    return out;
}
async function loadMetricColumn(args) {
    const { tableId, columnKey, entityKind } = args;
    const db = getDb();
    const rows = await db
        .select()
        .from(metricsSegments)
        .where(and(eq(metricsSegments.isActive, true), eq(metricsSegments.entityKind, entityKind), sql `(${metricsSegments.rule} ->> 'kind') = 'table_metric'`, sql `(${metricsSegments.rule} -> 'table' ->> 'tableId') = ${tableId}`, sql `(${metricsSegments.rule} -> 'table' ->> 'columnKey') = ${columnKey}`))
        .orderBy(asc(metricsSegments.key))
        .limit(1);
    if (!rows.length)
        return null;
    return parseMetricColumnFromSegmentRow(rows[0]);
}
/**
 * GET /api/metrics/segments/table-metrics?tableId=projects&entityKind=project
 *
 * Lists metric-derived computed columns for a tableId.
 *
 * NOTE: These are stored as rows in metrics_segments with rule.kind="table_metric" (app-level config).
 */
export async function GET(request) {
    const gate = requireUserOrService(request);
    if (!gate.ok)
        return gate.res;
    const url = new URL(request.url);
    const tableId = String(url.searchParams.get('tableId') || '').trim();
    const entityKind = String(url.searchParams.get('entityKind') || '').trim();
    if (!tableId)
        return jsonError('Missing tableId', 400);
    const columns = await loadMetricColumns({ tableId, entityKind: entityKind || undefined });
    return NextResponse.json({ data: { tableId, entityKind: entityKind || null, columns } });
}
/**
 * POST /api/metrics/segments/table-metrics/evaluate
 *
 * Body:
 *  - tableId: string
 *  - columnKey: string
 *  - entityKind: string
 *  - entityIds: string[]
 *
 * Returns:
 *  - data: { values: Record<entityId, number> }
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
    const idsRaw = Array.isArray(body.entityIds) ? body.entityIds : [];
    const entityIds = idsRaw.map((x) => String(x || '').trim()).filter(Boolean);
    if (!tableId)
        return jsonError('Missing tableId', 400);
    if (!columnKey)
        return jsonError('Missing columnKey', 400);
    if (!entityKind)
        return jsonError('Missing entityKind', 400);
    if (entityIds.length === 0)
        return NextResponse.json({ data: { values: {} } });
    if (entityIds.length > 500)
        return jsonError('Too many entityIds (max 500)', 400);
    const def = await loadMetricColumn({ tableId, columnKey, entityKind });
    if (!def)
        return jsonError(`Metric column not found: ${tableId}.${columnKey} (${entityKind})`, 404);
    // Check metric ACL: admin bypasses, otherwise check via auth module.
    // If the user doesn't have access to this metricKey, return empty values.
    const auth = getAuthContext(request);
    if (auth?.kind !== 'service' && !isAdminUser(request)) {
        const permissions = await checkMetricPermissions(request, [def.metricKey]);
        if (!permissions[def.metricKey]) {
            // User doesn't have access to this metric - return empty values (fail closed for data access)
            return NextResponse.json({ data: { values: {} } });
        }
    }
    const db = getDb();
    const ids = entityIds;
    const idList = ids.map((id) => sql `${id}`);
    const whereParts = [
        eq(metricsMetricPoints.entityKind, entityKind),
        eq(metricsMetricPoints.metricKey, def.metricKey),
        sql `${metricsMetricPoints.entityId} in (${sql.join(idList, sql `, `)})`,
    ];
    if (def.window && def.window !== 'all_time') {
        const wr = windowRange(def.window);
        if (wr.start)
            whereParts.push(gte(metricsMetricPoints.date, wr.start));
        if (wr.end)
            whereParts.push(lte(metricsMetricPoints.date, wr.end));
    }
    const values = {};
    const treatMissingAsZero = def.agg === 'sum' || def.agg === 'count';
    if (def.agg === 'last') {
        const rnExpr = sql `row_number() over (partition by ${metricsMetricPoints.entityId} order by ${metricsMetricPoints.date} desc)`.as('rn');
        const base = db
            .select({
            entityId: metricsMetricPoints.entityId,
            value: sql `${metricsMetricPoints.value}::float8`.as('value'),
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
        const rows = await db.select({ entityId: latest.entityId, v: latest.value }).from(latest);
        const byId = new Map();
        for (const row of rows) {
            const id = String(row?.entityId ?? '').trim();
            const v = asNumber(row?.v);
            if (!id || v === null)
                continue;
            byId.set(id, v);
        }
        for (const id of ids) {
            const v = byId.get(id);
            if (v === undefined)
                continue;
            values[id] = v;
        }
        return NextResponse.json({ data: { values } });
    }
    const aggExpr = def.agg === 'sum'
        ? sql `sum(${metricsMetricPoints.value})`
        : def.agg === 'avg'
            ? sql `avg(${metricsMetricPoints.value})`
            : def.agg === 'min'
                ? sql `min(${metricsMetricPoints.value})`
                : def.agg === 'max'
                    ? sql `max(${metricsMetricPoints.value})`
                    : sql `count(*)`;
    const rows = await db
        .select({
        entityId: metricsMetricPoints.entityId,
        v: sql `${aggExpr}::float8`.as('v'),
    })
        .from(metricsMetricPoints)
        .where(and(...whereParts))
        .groupBy(metricsMetricPoints.entityId);
    const byId = new Map();
    for (const row of rows) {
        const id = String(row?.entityId ?? '').trim();
        const v = asNumber(row?.v);
        if (!id || v === null)
            continue;
        byId.set(id, v);
    }
    for (const id of ids) {
        const v = byId.has(id) ? byId.get(id) : (treatMissingAsZero ? 0 : undefined);
        if (v === undefined)
            continue;
        values[id] = v;
    }
    // ---------------------------------------------------------------------------
    // Fallback for Projects revenue columns in production:
    //
    // In some deployments, sales metrics (e.g. gross_revenue_usd) are ingested under
    // entity_kind = forms_storefronts (or other), NOT entity_kind = project.
    //
    // The Projects table expects per-project values. We can derive them by summing
    // points by the steam_app_id dimension, using metrics_links metadata that maps
    // project_slug -> steam_app_id (created by field-mapper mapping).
    //
    // We ONLY apply this fallback when:
    // - table entityKind is "project"
    // - agg is sum/avg/min/max/count (not last)
    // - and the direct entity_kind=project lookup produced no rows for the requested ids
    // ---------------------------------------------------------------------------
    const shouldTrySteamAppFallback = entityKind === 'project' &&
        def.metricKey &&
        // Keep this narrow: only apply to USD-like metrics for now.
        (def.metricKey.endsWith('_usd') || def.metricKey.includes('revenue'));
    if (shouldTrySteamAppFallback && byId.size === 0) {
        try {
            // Build project_id -> [steam_app_id...] mapping from metrics_links metadata.
            // We intentionally join by metadata.project_slug so this works even when the
            // mapping's target_kind is not "project" (e.g. forms_storefronts).
            const idList2 = ids.map((id) => sql `${id}`);
            const ml = metricsLinks;
            const mp = metricsMetricPoints;
            const whereLinks = and(sql `${projectsTable.id} in (${sql.join(idList2, sql `, `)})`, eq(ml.linkType, 'metrics.field_mapper'), sql `(${ml.metadata} ->> 'project_slug') = ${projectsTable.slug}`, sql `coalesce((${ml.metadata} ->> 'steam_app_id'), '') <> ''`);
            // Apply time window (same as main path).
            const timeParts = [];
            if (def.window && def.window !== 'all_time') {
                const wr = windowRange(def.window);
                if (wr.start)
                    timeParts.push(gte(mp.date, wr.start));
                if (wr.end)
                    timeParts.push(lte(mp.date, wr.end));
            }
            const rows2 = await db
                .select({
                projectId: projectsTable.id,
                v: sql `${aggExpr}::float8`.as('v'),
            })
                .from(projectsTable)
                .innerJoin(ml, whereLinks)
                .innerJoin(mp, and(eq(mp.metricKey, def.metricKey), 
            // match by steam_app_id dimension (regardless of entityKind/entityId)
            sql `(${mp.dimensions} ->> 'steam_app_id') = (${ml.metadata} ->> 'steam_app_id')`, ...timeParts))
                .groupBy(projectsTable.id);
            const byProject = new Map();
            for (const row of rows2) {
                const pid = String(row?.projectId ?? '').trim();
                const v = asNumber(row?.v);
                if (!pid || v === null)
                    continue;
                byProject.set(pid, v);
            }
            if (byProject.size > 0) {
                // Overwrite values with fallback values where available; keep zeros for others.
                for (const id of ids) {
                    const v = byProject.has(id) ? byProject.get(id) : (treatMissingAsZero ? 0 : undefined);
                    if (v === undefined)
                        continue;
                    values[id] = v;
                }
            }
        }
        catch {
            // Best-effort fallback; keep existing values (likely zeros).
        }
    }
    return NextResponse.json({ data: { values } });
}
