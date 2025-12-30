import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    tableId: z.ZodString;
    columnKey: z.ZodString;
    entityKind: z.ZodString;
    pageSize: z.ZodOptional<z.ZodNumber>;
    bucketPages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    entityKind: string;
    tableId: string;
    columnKey: string;
    pageSize?: number | undefined;
    bucketPages?: Record<string, number> | undefined;
}, {
    entityKind: string;
    tableId: string;
    columnKey: string;
    pageSize?: number | undefined;
    bucketPages?: Record<string, number> | undefined;
}>;
//# sourceMappingURL=segments-table-buckets.schema.d.ts.map