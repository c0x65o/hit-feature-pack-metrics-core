import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export { drilldownSchema } from './drilldown.schema';
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    meta: {
        derivedFrom: any;
        resolvedPointFilter: any;
        reportTimezone: string;
    };
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
    points: any;
    contributors: any;
}>>;
//# sourceMappingURL=drilldown.d.ts.map