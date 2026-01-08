import { NextRequest, NextResponse } from 'next/server';
import { type PartnerDefinition } from '../lib/partners';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function GET(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    definition: PartnerDefinition;
    credential: {
        id: any;
        enabled: any;
        credentials: any;
        lastVerifiedAt: any;
        lastVerifyOk: any;
        lastVerifyMessage: any;
    } | null;
}>>;
export declare function PUT(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
export declare function DELETE(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=partners-id.d.ts.map