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
export {};
//# sourceMappingURL=computed-metrics.d.ts.map