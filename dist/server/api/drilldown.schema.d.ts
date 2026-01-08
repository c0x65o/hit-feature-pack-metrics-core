import { z } from 'zod';
export declare const drilldownSchema: z.ZodObject<{
    baseQuery: z.ZodOptional<z.ZodObject<{
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
    rowContext: z.ZodOptional<z.ZodObject<{
        bucket: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    }, z.core.$strip>>;
    pointFilter: z.ZodOptional<z.ZodObject<{
        metricKey: z.ZodString;
        start: z.ZodOptional<z.ZodString>;
        end: z.ZodOptional<z.ZodString>;
        entityKind: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        entityIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        dataSourceId: z.ZodOptional<z.ZodString>;
        sourceGranularity: z.ZodOptional<z.ZodString>;
        dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    }, z.core.$strip>>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    includeContributors: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
//# sourceMappingURL=drilldown.schema.d.ts.map