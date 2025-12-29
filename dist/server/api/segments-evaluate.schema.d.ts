import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    segmentKey: z.ZodString;
    entityKind: z.ZodString;
    entityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    entityKind: string;
    entityId: string;
    segmentKey: string;
}, {
    entityKind: string;
    entityId: string;
    segmentKey: string;
}>;
//# sourceMappingURL=segments-evaluate.schema.d.ts.map