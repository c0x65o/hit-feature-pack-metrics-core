import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    points: z.ZodArray<z.ZodObject<{
        entityKind: z.ZodString;
        entityId: z.ZodString;
        metricKey: z.ZodString;
        dataSourceId: z.ZodString;
        date: z.ZodString;
        granularity: z.ZodOptional<z.ZodString>;
        value: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
        dimensions: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        syncRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ingestBatchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
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
    }, z.core.$strip>>;
}, z.core.$strip>;
//# sourceMappingURL=ingest.schema.d.ts.map