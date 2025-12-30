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
}, "strip", z.ZodTypeAny, {
    key: string;
    label: string;
    unit: string;
    isActive: boolean;
    sortOrder: number;
    defaultGranularity: string;
    rollupStrategy: string;
    description?: string | null | undefined;
    category?: string | null | undefined;
    allowedGranularities?: any;
    dimensionsSchema?: any;
    validationRules?: any;
}, {
    key: string;
    label: string;
    description?: string | null | undefined;
    unit?: string | undefined;
    isActive?: boolean | undefined;
    sortOrder?: number | undefined;
    category?: string | null | undefined;
    defaultGranularity?: string | undefined;
    allowedGranularities?: any;
    dimensionsSchema?: any;
    validationRules?: any;
    rollupStrategy?: string | undefined;
}>;
//# sourceMappingURL=definitions.schema.d.ts.map