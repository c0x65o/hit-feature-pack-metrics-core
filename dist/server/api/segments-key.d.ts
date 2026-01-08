import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type RouteParams = {
    params: {
        key: string;
    };
};
export declare function GET(request: NextRequest, ctx: RouteParams): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: any;
}>>;
export declare function PUT(request: NextRequest, ctx: RouteParams): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: any;
}>>;
export declare function DELETE(request: NextRequest, ctx: RouteParams): Promise<NextResponse<unknown>>;
export {};
//# sourceMappingURL=segments-key.d.ts.map