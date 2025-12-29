import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    file: z.ZodOptional<z.ZodType<File, z.ZodTypeDef, File>>;
    overwrite: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    file?: File | undefined;
    overwrite?: string | undefined;
}, {
    file?: File | undefined;
    overwrite?: string | undefined;
}>;
//# sourceMappingURL=ingestors-id-upload.schema.d.ts.map