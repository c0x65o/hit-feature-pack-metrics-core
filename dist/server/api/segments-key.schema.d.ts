import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rule: z.ZodOptional<z.ZodObject<{
        kind: z.ZodString;
    }, z.core.$loose>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
//# sourceMappingURL=segments-key.schema.d.ts.map