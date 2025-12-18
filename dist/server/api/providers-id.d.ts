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
    tasks?: {
        sync?: string;
        backfill?: string;
    };
    upload?: {
        enabled?: boolean;
        mapping?: {
            kind?: string;
            link_type?: string;
            key?: string;
        };
    };
    backfill?: {
        enabled?: boolean;
        kind?: string;
        dir?: string;
        pattern?: string;
        validate_mappings?: boolean;
        command?: string;
    };
    integration?: {
        partner_id?: string;
        required?: boolean;
    };
};
export declare function GET(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    provider: IngestorConfig;
    artifacts: {
        backfillFiles: string[];
        mappingMissing: string[];
        linkedProjects: {
            projectId: string;
            projectSlug: string | null;
            steamAppIds: Array<{
                steamAppId: string;
                group: string | null;
            }>;
            fileNames: string[];
        }[];
        mapping: {
            kind: string;
            linkType: string | null;
            key: string | null;
        } | null;
        integration: {
            partnerId: string;
            requiredFields: string[];
            configured: any;
            enabled: any;
            missingFields: string[];
        } | null;
        stats: any;
        tasks: {
            backfill: {
                name: string;
                command: string;
                description: string | null;
            } | null;
            sync: {
                name: string;
                command: string;
                description: string | null;
            } | null;
        };
    };
}>>;
export {};
//# sourceMappingURL=providers-id.d.ts.map