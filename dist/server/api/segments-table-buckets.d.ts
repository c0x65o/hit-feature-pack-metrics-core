import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type BucketDef = {
    segmentKey: string;
    bucketLabel: string;
    sortOrder: number;
    columnKey: string;
    columnLabel?: string;
    entityKind?: string;
    entityIdField?: string;
};
/**
 * GET /api/metrics/segments/table-buckets?tableId=projects&columnKey=revenue_bucket&entityKind=project
 *
 * Lists bucket segments (definitions) linked to a given tableId+columnKey.
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        tableId: string;
        entityKind: string | null;
        columns: {
            columnKey: string;
            columnLabel: string | null;
            entityKind: string | null;
            entityIdField: string;
            buckets: Array<{
                segmentKey: string;
                bucketLabel: string;
                sortOrder: number;
            }>;
        }[];
    };
}> | NextResponse<{
    data: {
        tableId: string;
        columnKey: string;
        columnLabel: string | null;
        entityKind: string | null;
        entityIdField: string;
        buckets: BucketDef[];
    };
}>>;
/**
 * POST /api/metrics/segments/table-buckets/query
 *
 * Returns counts and a page of entityIds per bucket (server-side).
 *
 * Body:
 *  - tableId: string
 *  - columnKey: string
 *  - entityKind: string
 *  - pageSize?: number (per bucket)
 *  - bucketPages?: Record<segmentKey, pageNumber>  (per bucket)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        tableId: string;
        columnKey: string;
        entityKind: string;
        buckets: {
            bucketLabel: string;
            sortOrder: number;
            segmentKey: string;
            page: number;
            pageSize: number;
            total: number;
            items: string[];
        }[];
    };
}>>;
export {};
//# sourceMappingURL=segments-table-buckets.d.ts.map