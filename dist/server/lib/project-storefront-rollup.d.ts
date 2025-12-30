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
export declare function rollupStorefrontMetricByProject(args: RollupArgs): Promise<Map<string, number>>;
export {};
//# sourceMappingURL=project-storefront-rollup.d.ts.map