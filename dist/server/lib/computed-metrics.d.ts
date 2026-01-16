import type { SQL } from 'drizzle-orm';
type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';
type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
export type QueryBody = {
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
    params?: Record<string, string | number | boolean | null>;
    dimensions?: Record<string, string | number | boolean | null>;
    groupBy?: string[];
    groupByEntityId?: boolean;
};
export type ComputedQueryResult = {
    ok: true;
    data: any[];
    meta: Record<string, any>;
} | {
    ok: false;
    error: string;
};
export type ComputedDrilldownResult = {
    ok: true;
    points: any[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
    meta: Record<string, any>;
} | {
    ok: false;
    error: string;
};
/**
 * Computed metrics (feature-pack owned):
 *
 * metrics-core is intentionally pack-agnostic. Any computed-metric implementation
 * must live in the owning feature pack and be registered/injected by the app.
 *
 * For now, we return null so callers fall back to stored points.
 */
export declare function tryRunComputedMetricQuery(_args: {
    db: any;
    body: QueryBody;
    catalogEntry?: any;
}): Promise<ComputedQueryResult | null>;
/**
 * Computed drilldown (feature-pack owned):
 *
 * When a metric has no stored points, /api/metrics/drilldown will try this.
 * Returning null means "no computed drilldown available".
 */
export declare function tryRunComputedMetricDrilldown(_args: {
    db: any;
    pointFilter: QueryBody;
    page: number;
    pageSize: number;
    catalogEntry?: any;
}): Promise<ComputedDrilldownResult | null>;
export type _ComputedMetricsSqlBrand = SQL | null;
export {};
//# sourceMappingURL=computed-metrics.d.ts.map