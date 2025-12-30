import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export type MetricAgg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';

type RollupArgs = {
  projectIds: string[];
  metricKey: string;
  agg: MetricAgg;
  start?: Date | null;
  end?: Date | null;
};

/**
 * Best-effort rollup for project-scoped metrics when raw points were ingested against
 * storefront entries (entity_kind='forms_storefronts', entity_id=form_entries.id).
 *
 * - Joins form_entries(form_id='form_storefronts') → metrics_metric_points
 * - Groups by the projectId stored at form_entries.data.project.entityId
 *
 * IMPORTANT:
 * - This is intentionally implemented with raw SQL so metrics-core doesn't hard-depend
 *   on the Forms feature pack's drizzle schema types.
 * - If the Forms tables aren't present, this returns an empty map (silent fallback).
 */
export async function rollupStorefrontMetricByProject(args: RollupArgs): Promise<Map<string, number>> {
  const projectIds = (args.projectIds || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (projectIds.length === 0) return new Map();

  const metricKey = String(args.metricKey || '').trim();
  if (!metricKey) return new Map();

  const agg = args.agg;
  const start = args.start ?? null;
  const end = args.end ?? null;

  const db = getDb();
  const pidList = projectIds.map((id) => sql`${id}`);

  // NOTE: form_entries.data stores:
  //   { project: { entityKind: 'project', entityId: '<uuid>', ... }, platform: 'steam', ... }
  const projectIdExpr = sql<string>`("fe"."data" -> 'project' ->> 'entityId')`;

  const dateWhere =
    start && end
      ? sql`and "mp"."date" >= ${start} and "mp"."date" <= ${end}`
      : start
        ? sql`and "mp"."date" >= ${start}`
        : end
          ? sql`and "mp"."date" <= ${end}`
          : sql``;

  try {
    if (agg === 'last') {
      const res = await db.execute(sql`
        with base as (
          select
            ${projectIdExpr} as "projectId",
            ("mp"."value")::float8 as "value",
            row_number() over (
              partition by ${projectIdExpr}
              order by "mp"."date" desc
            ) as "rn"
          from "form_entries" fe
          join "metrics_metric_points" mp
            on "mp"."entity_kind" = 'forms_storefronts'
            and "mp"."entity_id" = "fe"."id"
            and "mp"."metric_key" = ${metricKey}
            ${dateWhere}
          where "fe"."form_id" = 'form_storefronts'
            and ${projectIdExpr} in (${sql.join(pidList, sql`, `)})
        )
        select "projectId", "value"
        from base
        where "rn" = 1
      `);

      const out = new Map<string, number>();
      for (const r of (((res as any).rows || []) as any[])) {
        const pid = String(r?.projectId || '').trim();
        const v = r?.value === null || r?.value === undefined ? null : Number(r.value);
        if (!pid || v === null || !Number.isFinite(v)) continue;
        out.set(pid, v);
      }
      return out;
    }

    const aggExpr =
      agg === 'sum'
        ? sql`sum("mp"."value")::float8`
        : agg === 'avg'
          ? sql`avg("mp"."value")::float8`
          : agg === 'min'
            ? sql`min("mp"."value")::float8`
            : agg === 'max'
              ? sql`max("mp"."value")::float8`
              : sql`count(*)::float8`;

    const res = await db.execute(sql`
      select
        ${projectIdExpr} as "projectId",
        ${aggExpr} as "value"
      from "form_entries" fe
      join "metrics_metric_points" mp
        on "mp"."entity_kind" = 'forms_storefronts'
        and "mp"."entity_id" = "fe"."id"
        and "mp"."metric_key" = ${metricKey}
        ${dateWhere}
      where "fe"."form_id" = 'form_storefronts'
        and ${projectIdExpr} in (${sql.join(pidList, sql`, `)})
      group by ${projectIdExpr}
    `);

    const out = new Map<string, number>();
    for (const r of (((res as any).rows || []) as any[])) {
      const pid = String(r?.projectId || '').trim();
      const v = r?.value === null || r?.value === undefined ? null : Number(r.value);
      if (!pid || v === null || !Number.isFinite(v)) continue;
      out.set(pid, v);
    }
    return out;
  } catch {
    // Forms pack not installed / tables missing / other DB error → ignore; caller will fall back to 0/empty.
    return new Map();
  }
}


