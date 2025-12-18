import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        id: string;
        label: string;
        description: string | null;
        fields: import("../lib/partners").PartnerFieldDefinition[];
        verify: import("../lib/partners").PartnerVerifyConfig | null;
        configured: boolean;
        enabled: boolean;
        lastVerifiedAt: Date | null;
        lastVerifyOk: boolean | null;
        lastVerifyMessage: string | null;
        missingFields: string[];
    }[];
    orphans: {
        id: string;
        configured: boolean;
        enabled: boolean;
        lastVerifiedAt: Date | null;
        lastVerifyOk: boolean | null;
        lastVerifyMessage: string | null;
    }[];
}>>;
//# sourceMappingURL=partners.d.ts.map