import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    linkType: z.ZodOptional<z.ZodString>;
    linkId: z.ZodOptional<z.ZodString>;
    targetKind: z.ZodOptional<z.ZodString>;
    targetId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
//# sourceMappingURL=links-id.schema.d.ts.map