import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function GET(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    columns: never[];
    rows: never[];
    meta: {
        id: string;
        kind: null;
        formId: null;
        limit: number;
        scanLimit: number;
        scanned: number;
        filtered: number;
        returned: number;
        truncatedScan: boolean;
    };
}> | NextResponse<{
    columns: {
        key: string;
        label: any;
    }[];
    rows: any;
    meta: {
        id: string;
        kind: "forms";
        formId: string;
        limit: number;
        scanLimit: number;
        scanned: any;
        filtered: any;
        returned: any;
        truncatedScan: boolean;
    };
}>>;
//# sourceMappingURL=providers-id-targets.d.ts.map