import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: any;
}>>;
export declare function POST(request: NextRequest): Promise<Response>;
//# sourceMappingURL=definitions.d.ts.map