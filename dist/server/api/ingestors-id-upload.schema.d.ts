import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    file: z.ZodOptional<z.ZodCustom<File, File>>;
    overwrite: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=ingestors-id-upload.schema.d.ts.map