import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function POST(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    ok: boolean;
    message: string;
    details: Record<string, unknown> | null;
}>>;
//# sourceMappingURL=partners-id-verify.d.ts.map