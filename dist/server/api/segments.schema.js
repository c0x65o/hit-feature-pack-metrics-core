import { z } from "zod";
// Schema-only module for:
// - POST /api/metrics/segments
const segmentRuleSchema = z.object({
    kind: z.string().min(1),
}).passthrough(); // Allow additional properties
export const postBodySchema = z.object({
    key: z.string().min(1),
    entityKind: z.string().min(1),
    label: z.string().min(1),
    description: z.string().nullable().optional(),
    rule: segmentRuleSchema,
    isActive: z.boolean().optional().default(true),
});
