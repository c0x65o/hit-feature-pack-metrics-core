import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    linkType: z.ZodOptional<z.ZodString>;
    linkId: z.ZodOptional<z.ZodString>;
    targetKind: z.ZodOptional<z.ZodString>;
    targetId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    linkType?: string | undefined;
    linkId?: string | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    targetKind?: string | undefined;
    targetId?: string | undefined;
}, {
    linkType?: string | undefined;
    linkId?: string | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    targetKind?: string | undefined;
    targetId?: string | undefined;
}>;
//# sourceMappingURL=links-id.schema.d.ts.map