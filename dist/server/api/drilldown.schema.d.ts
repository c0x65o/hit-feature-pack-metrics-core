import { z } from 'zod';
export declare const drilldownSchema: z.ZodObject<{
    baseQuery: z.ZodOptional<z.ZodObject<{
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
    }>>;
    rowContext: z.ZodOptional<z.ZodObject<{
        bucket: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    }, "strip", z.ZodTypeAny, {
        bucket?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
    }, {
        bucket?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
    }>>;
    pointFilter: z.ZodOptional<z.ZodObject<{
        metricKey: z.ZodString;
        start: z.ZodOptional<z.ZodString>;
        end: z.ZodOptional<z.ZodString>;
        entityKind: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        entityIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        dataSourceId: z.ZodOptional<z.ZodString>;
        sourceGranularity: z.ZodOptional<z.ZodString>;
        dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    }, "strip", z.ZodTypeAny, {
        metricKey: string;
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
    }, {
        metricKey: string;
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
    }>>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    includeContributors: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    includeContributors: boolean;
    baseQuery?: {
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
    } | undefined;
    rowContext?: {
        bucket?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
    } | undefined;
    pointFilter?: {
        metricKey: string;
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
    } | undefined;
}, {
    baseQuery?: {
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
    } | undefined;
    rowContext?: {
        bucket?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
    } | undefined;
    pointFilter?: {
        metricKey: string;
        end?: string | undefined;
        start?: string | undefined;
        entityKind?: string | undefined;
        dataSourceId?: string | undefined;
        entityId?: string | undefined;
        dimensions?: Record<string, string | number | boolean | null> | undefined;
        entityIds?: string[] | undefined;
        sourceGranularity?: string | undefined;
    } | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    includeContributors?: boolean | undefined;
}>;
//# sourceMappingURL=drilldown.schema.d.ts.map