import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    segmentKey: z.ZodString;
    entityKind: z.ZodString;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    entityKind: string;
    segmentKey: string;
    page: number;
    pageSize: number;
}, {
    entityKind: string;
    segmentKey: string;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
//# sourceMappingURL=segments-query.schema.d.ts.map