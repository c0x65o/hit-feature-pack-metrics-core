import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type Bucket = 'none' | 'hour' | 'day' | 'week' | 'month';
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: any;
    meta: {
        metricKey: string;
        start: string | null;
        end: string | null;
        bucket: Bucket;
        agg: "last";
        groupBy: string[];
        groupByEntityId: boolean;
    };
}> | NextResponse<{
    data: any;
    meta: {
        metricKey: string;
        start: string | null;
        end: string | null;
        bucket: Bucket;
        agg: "sum" | "avg" | "min" | "max" | "count";
        groupBy: string[];
        groupByEntityId: boolean;
    };
}>>;
export {};
//# sourceMappingURL=query.d.ts.map