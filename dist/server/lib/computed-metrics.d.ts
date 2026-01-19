/**
 * Computed metrics module.
 *
 * This module provides fallback support for metrics that are declared in the catalog
 * but not stored as points. Instead, they are computed on-the-fly from source tables.
 */
import type { NextRequest } from 'next/server';
export type QueryBody = {
    metricKey: string;
    start?: string;
    end?: string;
    bucket?: 'none' | 'hour' | 'day' | 'week' | 'month';
    agg?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
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
    meta: any;
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
    meta: any;
} | {
    ok: false;
    error: string;
};
export declare function tryRunComputedMetricQuery(args: {
    db: any;
    body: QueryBody;
    catalogEntry?: any;
    request?: NextRequest;
}): Promise<ComputedQueryResult | null>;
/**
 * Try to run a computed metric drilldown query.
 * Returns null if the metric is not a computed metric or if computation is not supported.
 */
export declare function tryRunComputedMetricDrilldown(args: {
    db: any;
    pointFilter: QueryBody;
    page: number;
    pageSize: number;
    catalogEntry?: any;
    request?: NextRequest;
}): Promise<ComputedDrilldownResult | null>;
//# sourceMappingURL=computed-metrics.d.ts.map