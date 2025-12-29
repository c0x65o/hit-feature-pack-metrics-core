import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    points: z.ZodArray<z.ZodObject<{
        entityKind: z.ZodString;
        entityId: z.ZodString;
        metricKey: z.ZodString;
        dataSourceId: z.ZodString;
        date: z.ZodString;
        granularity: z.ZodOptional<z.ZodString>;
        value: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
        dimensions: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        syncRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ingestBatchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        value: string | number;
        date: string;
        entityKind: string;
        dataSourceId: string;
        entityId: string;
        metricKey: string;
        syncRunId?: string | null | undefined;
        ingestBatchId?: string | null | undefined;
        granularity?: string | undefined;
        dimensions?: Record<string, unknown> | null | undefined;
    }, {
        value: string | number;
        date: string;
        entityKind: string;
        dataSourceId: string;
        entityId: string;
        metricKey: string;
        syncRunId?: string | null | undefined;
        ingestBatchId?: string | null | undefined;
        granularity?: string | undefined;
        dimensions?: Record<string, unknown> | null | undefined;
    }>, "many">;
    dataSource: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        entityKind: z.ZodString;
        entityId: z.ZodString;
        connectorKey: z.ZodString;
        sourceKind: z.ZodString;
        externalRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        schedule: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        config: z.ZodOptional<z.ZodUnknown>;
        overlapPolicy: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        entityKind: string;
        entityId: string;
        connectorKey: string;
        sourceKind: string;
        enabled?: boolean | undefined;
        externalRef?: string | null | undefined;
        schedule?: string | null | undefined;
        config?: unknown;
        overlapPolicy?: string | undefined;
    }, {
        id: string;
        entityKind: string;
        entityId: string;
        connectorKey: string;
        sourceKind: string;
        enabled?: boolean | undefined;
        externalRef?: string | null | undefined;
        schedule?: string | null | undefined;
        config?: unknown;
        overlapPolicy?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    points: {
        value: string | number;
        date: string;
        entityKind: string;
        dataSourceId: string;
        entityId: string;
        metricKey: string;
        syncRunId?: string | null | undefined;
        ingestBatchId?: string | null | undefined;
        granularity?: string | undefined;
        dimensions?: Record<string, unknown> | null | undefined;
    }[];
    dataSource?: {
        id: string;
        entityKind: string;
        entityId: string;
        connectorKey: string;
        sourceKind: string;
        enabled?: boolean | undefined;
        externalRef?: string | null | undefined;
        schedule?: string | null | undefined;
        config?: unknown;
        overlapPolicy?: string | undefined;
    } | undefined;
}, {
    points: {
        value: string | number;
        date: string;
        entityKind: string;
        dataSourceId: string;
        entityId: string;
        metricKey: string;
        syncRunId?: string | null | undefined;
        ingestBatchId?: string | null | undefined;
        granularity?: string | undefined;
        dimensions?: Record<string, unknown> | null | undefined;
    }[];
    dataSource?: {
        id: string;
        entityKind: string;
        entityId: string;
        connectorKey: string;
        sourceKind: string;
        enabled?: boolean | undefined;
        externalRef?: string | null | undefined;
        schedule?: string | null | undefined;
        config?: unknown;
        overlapPolicy?: string | undefined;
    } | undefined;
}>;
//# sourceMappingURL=ingest.schema.d.ts.map