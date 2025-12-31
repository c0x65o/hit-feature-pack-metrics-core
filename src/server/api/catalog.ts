import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { inArray, sql } from 'drizzle-orm';
import { checkMetricPermissions } from '../lib/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MetricStatus = {
  key: string;
  label: string;
  unit: string;
  category?: string;
  description?: string;
  icon?: string;
  icon_color?: string;
  rollup_strategy?: string;
  time_kind?: 'timeseries' | 'realtime' | 'none';
  default_granularity?: string;
  allowed_granularities?: string[];
  owner?: { kind: 'feature_pack' | 'app' | 'user'; id: string };
  entity_kinds?: string[];
  dimensions_schema?: Record<string, any>;
  /**
   * Optional UI hints (app-defined).
   * Example use-case: declare a computed metric column / bucket column for a specific tableId.
   *
   * This is intentionally untyped and pass-through: the catalog generator (and apps) own the schema.
   */
  ui?: Record<string, any>;
  pointsCount: number;
  firstPointAt: string | null;
  lastPointAt: string | null;
  lastUpdatedAt: string | null;
};

export async function GET(request: NextRequest) {
  // Unified response:
  // - Compiled catalog (.hit/metrics/catalog.generated.ts): FP + app-level metrics (owner-aware)
  // - DB definitions (metrics_metric_definitions): ad-hoc/custom/user-defined metrics
  //
  // Catalog generation is strongly preferred, but DB definitions should still show up even
  // if the generated catalog hasn't been built yet (so the UI can always show "all metrics").
  let compiledCatalog: Record<string, any> = {};
  let catalogMissingMessage: string | null = null;
  try {
    // Dynamic import to handle case where catalog doesn't exist yet
    const catalogModule = await import('@/.hit/metrics/catalog.generated');
    compiledCatalog = catalogModule.METRICS_CATALOG || {};
  } catch {
    catalogMissingMessage = 'Metrics catalog not generated. Run `hit run` to generate it.';
  }

  const db = getDb();

  // Load DB-backed definitions (created via API or seeded).
  // NOTE: This table doesn't currently encode "owner". We treat DB-only metrics as "user" for UI chips.
  let dbDefs: Array<Record<string, any>> = [];
  try {
    const mod = await import('@/lib/feature-pack-schemas');
    const metricsMetricDefinitions = (mod as any).metricsMetricDefinitions;
    if (metricsMetricDefinitions) {
      dbDefs = await db.select().from(metricsMetricDefinitions);
    }
  } catch {
    // If schema isn't available for some reason, just skip DB defs.
    dbDefs = [];
  }

  // Merge keys: compiled catalog keys + DB-only keys.
  const mergedByKey = new Map<string, any>();
  for (const [k, v] of Object.entries(compiledCatalog)) {
    mergedByKey.set(k, v);
  }
  for (const row of dbDefs) {
    const k = typeof row?.key === 'string' ? row.key : '';
    if (!k) continue;
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
          ? (row.allowedGranularities as any[]).filter((x) => typeof x === 'string')
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

  // FAIL CLOSED: check metric read permissions
  const permissions = await checkMetricPermissions(request, keys);
  const allowedKeys = keys.filter((k) => permissions[k]);

  if (allowedKeys.length === 0) {
    return NextResponse.json({ items: [], message: catalogMissingMessage || undefined });
  }

  const statsRows = await db
    .select({
      metricKey: (metricsMetricPoints as any).metricKey,
      pointsCount: sql<number>`count(*)`.as('pointsCount'),
      firstPointAt: sql<Date | null>`min(${(metricsMetricPoints as any).date})`.as('firstPointAt'),
      lastPointAt: sql<Date | null>`max(${(metricsMetricPoints as any).date})`.as('lastPointAt'),
      lastUpdatedAt: sql<Date | null>`max(${(metricsMetricPoints as any).updatedAt})`.as('lastUpdatedAt'),
      // Infer which entity kinds this metric actually exists under (helps dashboards pick correct scoping).
      entityKinds: sql<string[] | null>`array_remove(array_agg(distinct ${(metricsMetricPoints as any).entityKind}), null)`.as('entityKinds'),
    })
    .from(metricsMetricPoints as any)
    .where(inArray((metricsMetricPoints as any).metricKey, allowedKeys))
    .groupBy((metricsMetricPoints as any).metricKey);

  const byKey = new Map<string, any>();
  for (const r of statsRows as any[]) {
    byKey.set(String(r.metricKey), r);
  }

  const items: MetricStatus[] = allowedKeys.map((k) => {
    const cfg = mergedByKey.get(k)!;
    const stat = byKey.get(k);
    return {
      key: k,
      label: cfg.label,
      unit: cfg.unit || 'count',
      category: cfg.category,
      description: cfg.description,
      icon: typeof cfg.icon === 'string' ? cfg.icon : undefined,
      icon_color: typeof cfg.icon_color === 'string' ? cfg.icon_color : undefined,
      rollup_strategy: cfg.rollup_strategy,
      time_kind:
        cfg.time_kind === 'realtime' || cfg.time_kind === 'none' || cfg.time_kind === 'timeseries'
          ? cfg.time_kind
          : 'timeseries',
      default_granularity: cfg.default_granularity,
      allowed_granularities: Array.isArray(cfg.allowed_granularities)
        ? (cfg.allowed_granularities as any[]).filter((x) => typeof x === 'string')
        : undefined,
      owner: cfg.owner,
      // Prefer catalog-declared entity kinds; otherwise infer from points.
      entity_kinds: Array.isArray(cfg.entity_kinds)
        ? (cfg.entity_kinds as any[]).filter((x: any) => typeof x === 'string')
        : Array.isArray(stat?.entityKinds)
          ? (stat.entityKinds as any[]).filter((x: any) => typeof x === 'string' && x)
          : undefined,
      dimensions_schema: cfg.dimensions_schema,
      ui: cfg.ui && typeof cfg.ui === 'object' ? cfg.ui : undefined,
      pointsCount: stat ? Number(stat.pointsCount || 0) : 0,
      firstPointAt: stat?.firstPointAt ? new Date(stat.firstPointAt).toISOString() : null,
      lastPointAt: stat?.lastPointAt ? new Date(stat.lastPointAt).toISOString() : null,
      lastUpdatedAt: stat?.lastUpdatedAt ? new Date(stat.lastUpdatedAt).toISOString() : null,
    };
  });

  return NextResponse.json({ items, message: catalogMissingMessage || undefined });
}

