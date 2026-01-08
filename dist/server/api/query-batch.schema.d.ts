import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    queries: z.ZodArray<z.ZodObject<{
        metricKey: z.ZodString;
        start: z.ZodOptional<z.ZodString>;
        end: z.ZodOptional<z.ZodString>;
        bucket: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            none: "none";
            month: "month";
            week: "week";
            hour: "hour";
            day: "day";
        }>>>;
        agg: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            sum: "sum";
            avg: "avg";
            min: "min";
            max: "max";
            last: "last";
            count: "count";
        }>>>;
        entityKind: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        entityIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        dataSourceId: z.ZodOptional<z.ZodString>;
        sourceGranularity: z.ZodOptional<z.ZodString>;
        dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
        groupBy: z.ZodOptional<z.ZodArray<z.ZodString>>;
        groupByEntityId: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
//# sourceMappingURL=query-batch.schema.d.ts.map