import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    segmentKey: z.ZodString;
    entityKind: z.ZodString;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
//# sourceMappingURL=segments-query.schema.d.ts.map