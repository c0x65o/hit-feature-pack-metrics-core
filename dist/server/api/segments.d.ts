import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
type SegmentRule = Record<string, unknown> & {
    kind?: string;
};
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: any;
}>>;
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    data: {
        id: string;
        key: string;
        entityKind: string;
        label: string;
        description: string | null;
        rule: SegmentRule;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
}>>;
export {};
//# sourceMappingURL=segments.d.ts.map