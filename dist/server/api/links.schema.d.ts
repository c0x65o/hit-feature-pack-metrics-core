import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    linkType: z.ZodString;
    linkId: z.ZodString;
    targetKind: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    targetId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    linkType: string;
    linkId: string;
    targetKind: string;
    metadata?: Record<string, unknown> | null | undefined;
    targetId?: string | undefined;
}, {
    linkType: string;
    linkId: string;
    metadata?: Record<string, unknown> | null | undefined;
    targetKind?: string | undefined;
    targetId?: string | undefined;
}>;
//# sourceMappingURL=links.schema.d.ts.map