import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/metrics/segments/table-buckets/evaluate
 *
 * Body:
 *  - tableId: string
 *  - columnKey: string
 *  - entityKind: string
 *  - entityIds: string[]
 *
 * Returns:
 *  - data: { values: Record<entityId, { bucketLabel: string; segmentKey: string } | null> }
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        values: {};
    };
}>>;
//# sourceMappingURL=segments-table-buckets-evaluate.d.ts.map