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
 * Computed metrics:
 * - Used when a metric key is declared in the catalog but we don't have (or don't want) stored points.
 * - Must return the SAME shape as /api/metrics/query: rows with { bucket?, value, ...groupByKeys }.
 */
export declare function tryRunComputedMetricQuery(args: {
    db: any;
    body: QueryBody;
    catalogEntry?: any;
}): Promise<ComputedQueryResult | null>;
/**
 * Computed drilldown:
 * - Used by /api/metrics/drilldown when the metric has no stored points.
 * - Returns "point-like" rows so dashboard drilldown stays functional.
 */
export declare function tryRunComputedMetricDrilldown(args: {
    db: any;
    pointFilter: QueryBody;
    page: number;
    pageSize: number;
    catalogEntry?: any;
}): Promise<ComputedDrilldownResult | null>;
export {};
//# sourceMappingURL=computed-metrics.d.ts.map