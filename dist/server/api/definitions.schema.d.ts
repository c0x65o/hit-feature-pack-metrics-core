import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    unit: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultGranularity: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    allowedGranularities: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    dimensionsSchema: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    validationRules: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    rollupStrategy: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
//# sourceMappingURL=definitions.schema.d.ts.map