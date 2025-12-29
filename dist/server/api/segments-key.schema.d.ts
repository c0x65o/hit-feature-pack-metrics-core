import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rule: z.ZodOptional<z.ZodObject<{
        kind: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        kind: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        kind: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    description?: string | null | undefined;
    label?: string | undefined;
    rule?: z.objectOutputType<{
        kind: z.ZodString;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    isActive?: boolean | undefined;
}, {
    description?: string | null | undefined;
    label?: string | undefined;
    rule?: z.objectInputType<{
        kind: z.ZodString;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    isActive?: boolean | undefined;
}>;
//# sourceMappingURL=segments-key.schema.d.ts.map