import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    queries: z.ZodArray<z.ZodObject<{
        metricKey: z.ZodString;
        start: z.ZodOptional<z.ZodString>;
        end: z.ZodOptional<z.ZodString>;
        bucket: z.ZodDefault<z.ZodOptional<z.ZodEnum<["none", "hour", "day", "week", "month"]>>>;
        agg: z.ZodDefault<z.ZodOptional<z.ZodEnum<["sum", "avg", "min", "max", "count", "last"]>>>;
        entityKind: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        entityIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        dataSourceId: z.ZodOptional<z.ZodString>;
        sourceGranularity: z.ZodOptional<z.ZodString>;
        dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
        groupBy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        groupByEntityId: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        bucket: "none" | "month" | "week" | "hour" | "day";
        metricKey: string;
        agg: "sum" | "avg" | "min" | "max" | "last" | "count";
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
        groupBy?: string[] | undefined;
        groupByEntityId?: boolean | undefined;
    }, {
        metricKey: string;
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        bucket?: "none" | "month" | "week" | "hour" | "day" | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        agg?: "sum" | "avg" | "min" | "max" | "last" | "count" | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
        groupBy?: string[] | undefined;
        groupByEntityId?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    queries: {
        bucket: "none" | "month" | "week" | "hour" | "day";
        metricKey: string;
        agg: "sum" | "avg" | "min" | "max" | "last" | "count";
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
        groupBy?: string[] | undefined;
        groupByEntityId?: boolean | undefined;
    }[];
}, {
    queries: {
        metricKey: string;
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        bucket?: "none" | "month" | "week" | "hour" | "day" | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        agg?: "sum" | "avg" | "min" | "max" | "last" | "count" | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
        groupBy?: string[] | undefined;
        groupByEntityId?: boolean | undefined;
    }[];
}>;
//# sourceMappingURL=query-batch.schema.d.ts.map