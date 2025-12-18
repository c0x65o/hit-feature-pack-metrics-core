import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type IngestorConfig = {
    id: string;
    label?: string;
    description?: string;
    metrics?: string[];
    data_source?: {
        id: string;
        connector_key?: string;
        source_kind?: string;
        external_ref?: string | null;
    };
    scope?: {
        entity_kind: string;
        entity_id: string;
    };
    upload?: {
        enabled?: boolean;
    };
    backfill?: {
        enabled?: boolean;
    };
};
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    ingestors: IngestorConfig[];
}>>;
export {};
//# sourceMappingURL=ingestors.d.ts.map