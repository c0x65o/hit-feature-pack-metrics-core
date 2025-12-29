import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    credentials: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    credentials?: Record<string, unknown> | undefined;
    enabled?: boolean | undefined;
}, {
    credentials?: Record<string, unknown> | undefined;
    enabled?: boolean | undefined;
}>;
//# sourceMappingURL=partners-id.schema.d.ts.map