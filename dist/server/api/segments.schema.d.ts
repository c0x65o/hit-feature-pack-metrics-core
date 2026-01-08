import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    key: z.ZodString;
    entityKind: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rule: z.ZodObject<{
        kind: z.ZodString;
    }, z.core.$loose>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
//# sourceMappingURL=segments.schema.d.ts.map