import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type Bucket = 'hour' | 'day' | 'week' | 'month';
type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count';
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: any;
    meta: {
        metricKey: string;
        start: string;
        end: string;
        bucket: Bucket;
        agg: Agg;
        groupBy: string[];
    };
}>>;
export {};
//# sourceMappingURL=query.d.ts.map