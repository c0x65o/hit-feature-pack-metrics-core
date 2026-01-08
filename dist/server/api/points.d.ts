import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export { pointsQuerySchema } from './points.schema';
/**
 * GET /api/metrics/points
 *
 * Paged raw metric points listing for drilldown + exports.
 *
 * Query params:
 * - metricKey (required)
 * - start/end (optional ISO strings)
 * - entityKind/entityId/entityIds (optional; entityIds can be comma-separated or JSON array)
 * - dataSourceId (optional)
 * - dimensions (optional JSON object as string)
 * - page/pageSize/order
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    meta: {
        reportTimezone: string;
    };
    data: any;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
}>>;
//# sourceMappingURL=points.d.ts.map