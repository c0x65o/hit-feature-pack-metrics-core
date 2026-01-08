import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    linkType: z.ZodString;
    linkId: z.ZodString;
    targetKind: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    targetId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
//# sourceMappingURL=links.schema.d.ts.map