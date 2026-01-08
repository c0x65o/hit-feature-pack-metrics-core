import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    tableId: z.ZodString;
    columnKey: z.ZodString;
    entityKind: z.ZodString;
    pageSize: z.ZodOptional<z.ZodNumber>;
    bucketPages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, z.core.$strip>;
//# sourceMappingURL=segments-table-buckets.schema.d.ts.map