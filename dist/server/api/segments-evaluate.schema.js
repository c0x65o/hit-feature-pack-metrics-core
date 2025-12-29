import { z } from "zod";
// Schema-only module for:
// - POST /api/metrics/segments/evaluate
export const postBodySchema = z.object({
    segmentKey: z.string().min(1),
    entityKind: z.string().min(1),
    entityId: z.string().min(1),
});
