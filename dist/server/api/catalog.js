import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { inArray, sql } from 'drizzle-orm';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
    // Unified response:
    // - Compiled catalog (.hit/metrics/catalog.generated.ts): FP + app-level metrics (owner-aware)
    // - DB definitions (metrics_metric_definitions): ad-hoc/custom/user-defined metrics
    //
    // Catalog generation is strongly preferred, but DB definitions should still show up even
    // if the generated catalog hasn't been built yet (so the UI can always show "all metrics").
    let compiledCatalog = {};
    let catalogMissingMessage = null;
    try {
        // Dynamic import to handle case where catalog doesn't exist yet
        const catalogModule = await import('@/.hit/metrics/catalog.generated');
        compiledCatalog = catalogModule.METRICS_CATALOG || {};
    }
    catch {
        catalogMissingMessage = 'Metrics catalog not generated. Run `hit run` to generate it.';
    }
    const db = getDb();
    // Load DB-backed definitions (created via API or seeded).
    // NOTE: This table doesn't currently encode "owner". We treat DB-only metrics as "user" for UI chips.
    let dbDefs = [];
    try {
        const mod = await import('@/lib/feature-pack-schemas');
        const metricsMetricDefinitions = mod.metricsMetricDefinitions;
        if (metricsMetricDefinitions) {
            dbDefs = await db.select().from(metricsMetricDefinitions);
        }
    }
    catch {
        // If schema isn't available for some reason, just skip DB defs.
        dbDefs = [];
    }
    // Merge keys: compiled catalog keys + DB-only keys.
    const mergedByKey = new Map();
    for (const [k, v] of Object.entries(compiledCatalog)) {
        mergedByKey.set(k, v);
    }
    for (const row of dbDefs) {
        const k = typeof row?.key === 'string' ? row.key : '';
        if (!k)
            continue;
        if (!mergedByKey.has(k)) {
            mergedByKey.set(k, {
                key: k,
                label: row.label,
                unit: row.unit,
                category: row.category ?? undefined,
                description: row.description ?? undefined,
                rollup_strategy: row.rollupStrategy ?? undefined,
                time_kind: 'timeseries',
                default_granularity: row.defaultGranularity ?? undefined,
                allowed_granularities: Array.isArray(row.allowedGranularities)
                    ? row.allowedGranularities.filter((x) => typeof x === 'string')
                    : undefined,
                dimensions_schema: row.dimensionsSchema ?? undefined,
                // No native owner in DB yet; treat as user-defined for now.
                owner: { kind: 'user', id: 'db' },
            });
        }
    }
    const keys = Array.from(mergedByKey.keys()).sort();
    if (keys.length === 0) {
        return NextResponse.json({ items: [], message: catalogMissingMessage || undefined });
    }
    // NOTE: The catalog lists ALL metrics without ACL filtering.
    // Metric ACLs are for DATA access (query, points, drilldown), not for listing definitions.
    // Page access is controlled separately by route permissions - if you can access the metrics
    // page, you can see what metrics exist. ACL only gates reading actual metric values.
    const allowedKeys = keys;
    const statsRows = await db
        .select({
        metricKey: metricsMetricPoints.metricKey,
        pointsCount: sql `count(*)`.as('pointsCount'),
        firstPointAt: sql `min(${metricsMetricPoints.date})`.as('firstPointAt'),
        lastPointAt: sql `max(${metricsMetricPoints.date})`.as('lastPointAt'),
        lastUpdatedAt: sql `max(${metricsMetricPoints.updatedAt})`.as('lastUpdatedAt'),
        // Infer which entity kinds this metric actually exists under (helps dashboards pick correct scoping).
        entityKinds: sql `array_remove(array_agg(distinct ${metricsMetricPoints.entityKind}), null)`.as('entityKinds'),
    })
        .from(metricsMetricPoints)
        .where(inArray(metricsMetricPoints.metricKey, allowedKeys))
        .groupBy(metricsMetricPoints.metricKey);
    const byKey = new Map();
    for (const r of statsRows) {
        byKey.set(String(r.metricKey), r);
    }
    const items = allowedKeys.map((k) => {
        const cfg = mergedByKey.get(k);
        const stat = byKey.get(k);
        // Metrics defaulting semantics:
        // - If `default_roles_allow` is omitted, default to admin-only (matches "by default it is admin only").
        // - If provided, normalize/validate and use as-is.
        const draRaw = Array.isArray(cfg.default_roles_allow)
            ? cfg.default_roles_allow.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
            : [];
        const dra = draRaw.length ? draRaw : ['admin'];
        return {
            key: k,
            label: cfg.label,
            unit: cfg.unit || 'count',
            category: cfg.category,
            description: cfg.description,
            icon: typeof cfg.icon === 'string' ? cfg.icon : undefined,
            icon_color: typeof cfg.icon_color === 'string' ? cfg.icon_color : undefined,
            rollup_strategy: cfg.rollup_strategy,
            time_kind: cfg.time_kind === 'realtime' || cfg.time_kind === 'none' || cfg.time_kind === 'timeseries'
                ? cfg.time_kind
                : 'timeseries',
            default_granularity: cfg.default_granularity,
            allowed_granularities: Array.isArray(cfg.allowed_granularities)
                ? cfg.allowed_granularities.filter((x) => typeof x === 'string')
                : undefined,
            owner: cfg.owner,
            // Prefer catalog-declared entity kinds; otherwise infer from points.
            entity_kinds: Array.isArray(cfg.entity_kinds)
                ? cfg.entity_kinds.filter((x) => typeof x === 'string')
                : Array.isArray(stat?.entityKinds)
                    ? stat.entityKinds.filter((x) => typeof x === 'string' && x)
                    : undefined,
            dimensions_schema: cfg.dimensions_schema,
            ui: cfg.ui && typeof cfg.ui === 'object' ? cfg.ui : undefined,
            default_roles_allow: dra,
            pointsCount: stat ? Number(stat.pointsCount || 0) : 0,
            firstPointAt: stat?.firstPointAt ? new Date(stat.firstPointAt).toISOString() : null,
            lastPointAt: stat?.lastPointAt ? new Date(stat.lastPointAt).toISOString() : null,
            lastUpdatedAt: stat?.lastUpdatedAt ? new Date(stat.lastUpdatedAt).toISOString() : null,
        };
    });
    return NextResponse.json({ items, message: catalogMissingMessage || undefined });
}
