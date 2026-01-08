import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type MetricAgg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
type WindowPreset = 'all_time' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'month_to_date' | 'year_to_date';
type MetricColumnDef = {
    columnKey: string;
    columnLabel: string;
    entityKind: string | null;
    entityIdField: string;
    metricKey: string;
    agg: MetricAgg;
    window: WindowPreset | null;
    format: string | null;
    decimals: number | null;
    sortOrder: number;
};
/**
 * GET /api/metrics/segments/table-metrics?tableId=projects&entityKind=project
 *
 * Lists metric-derived computed columns for a tableId.
 *
 * NOTE: These are stored as rows in metrics_segments with rule.kind="table_metric" (app-level config).
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        tableId: string;
        entityKind: string | null;
        columns: MetricColumnDef[];
    };
}>>;
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
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        values: {};
    };
}>>;
export {};
//# sourceMappingURL=segments-table-metrics.d.ts.map