import { NextRequest, NextResponse } from 'next/server';
import { type PartnerFieldDefinition } from '../lib/partners';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        id: string;
        label: string;
        description: string | null;
        fields: PartnerFieldDefinition[];
        verify: {
            kind: "http" | "command";
            url?: string;
            method?: string;
            headers?: Record<string, string>;
            command?: string;
            envPrefix?: string;
        } | null;
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