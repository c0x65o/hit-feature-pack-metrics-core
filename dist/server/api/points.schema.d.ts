import { z } from 'zod';
export declare const pointsQuerySchema: z.ZodObject<{
    metricKey: z.ZodString;
    start: z.ZodOptional<z.ZodString>;
    end: z.ZodOptional<z.ZodString>;
    entityKind: z.ZodOptional<z.ZodString>;
    entityId: z.ZodOptional<z.ZodString>;
    entityIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dataSourceId: z.ZodOptional<z.ZodString>;
    dimensions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    order: z.ZodDefault<z.ZodOptional<z.ZodEnum<["date_desc", "date_asc"]>>>;
}, "strip", z.ZodTypeAny, {
    order: "date_desc" | "date_asc";
    metricKey: string;
    page: number;
    pageSize: number;
    end?: string | undefined;
    start?: string | undefined;
    entityKind?: string | undefined;
    dataSourceId?: string | undefined;
    entityId?: string | undefined;
    dimensions?: Record<string, string | number | boolean | null> | undefined;
    entityIds?: string[] | undefined;
}, {
    metricKey: string;
    end?: string | undefined;
    order?: "date_desc" | "date_asc" | undefined;
    start?: string | undefined;
    entityKind?: string | undefined;
    dataSourceId?: string | undefined;
    entityId?: string | undefined;
    dimensions?: Record<string, string | number | boolean | null> | undefined;
    entityIds?: string[] | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
//# sourceMappingURL=points.schema.d.ts.map