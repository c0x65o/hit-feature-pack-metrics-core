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
        metricsCount: number;
        uploadEnabled: boolean;
        backfillEnabled: boolean;
        dataSourceId: string | null;
        dataSourceConnectorKey: string | null;
        scope: {
            entity_kind: string;
            entity_id: string;
        } | null;
        backfillTaskName: string | null;
        backfillTaskCommand: string | null;
        syncTaskName: string | null;
        syncTaskCommand: string | null;
        backfillFilesCount: number;
        mapping: {
            kind: string;
            linkType: string | null;
            key: string;
        } | null;
        preflight: {
            mappingOk: boolean | null;
            mappingMissingCount: number | null;
            integrationPartnerId: string | null;
            integrationRequired: boolean;
            integrationOk: boolean | null;
            integrationMissingFields: string[] | null;
        };
        stats: {
            dataSourcesCount: number | null;
            pointsCount: number | null;
            firstPointDate: string | null;
            lastPointDate: string | null;
            lastUpdatedAt: string | null;
            lastBatchAt: string | null;
            lastBatchFile: string | null;
        };
    }[];
}>>;
//# sourceMappingURL=providers.d.ts.map