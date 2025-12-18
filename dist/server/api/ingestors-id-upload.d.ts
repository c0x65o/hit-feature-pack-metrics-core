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
    ingestorId: string;
    fileName: string;
    fileSize: number;
    resolved: {
        steamAppId: any;
        projectId: any;
        projectSlug: any;
        group: any;
    };
    dateRange: {
        start: string;
        end: string;
    };
    pointsUpserted: number;
    ingestBatchId: string;
}>>;
//# sourceMappingURL=ingestors-id-upload.d.ts.map