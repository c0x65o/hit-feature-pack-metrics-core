import { NextResponse } from 'next/server';
export declare const runtime = "nodejs";
export declare const dynamic = "force-dynamic";
type MetricStatus = {
    key: string;
    label: string;
    unit: string;
    category?: string;
    description?: string;
    icon?: string;
    icon_color?: string;
    rollup_strategy?: string;
    time_kind?: 'timeseries' | 'realtime' | 'none';
    default_granularity?: string;
    allowed_granularities?: string[];
    owner?: {
        kind: 'feature_pack' | 'app' | 'user';
        id: string;
    };
    entity_kinds?: string[];
    dimensions_schema?: Record<string, any>;
    /**
     * Optional UI hints (app-defined).
     * Example use-case: declare a computed metric column / bucket column for a specific tableId.
     *
     * This is intentionally untyped and pass-through: the catalog generator (and apps) own the schema.
     */
    ui?: Record<string, any>;
    pointsCount: number;
    firstPointAt: string | null;
    lastPointAt: string | null;
    lastUpdatedAt: string | null;
};
export declare function GET(): Promise<NextResponse<{
    items: MetricStatus[];
    message: string | undefined;
}>>;
export {};
//# sourceMappingURL=catalog.d.ts.map