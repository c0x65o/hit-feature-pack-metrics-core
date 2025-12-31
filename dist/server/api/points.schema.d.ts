import { z } from 'zod';
export declare const pointsQuerySchema: z.ZodObject<{
    metricKey: z.ZodString;
    start: z.ZodOptional<z.ZodString>;
    end: z.ZodOptional<z.ZodString>;
    entityKind: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
    entityIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    dataSourceId: z.ZodOptional<z.ZodString>;
    dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    order: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        date_desc: "date_desc";
        date_asc: "date_asc";
    }>>>;
}, z.core.$strip>;
//# sourceMappingURL=points.schema.d.ts.map