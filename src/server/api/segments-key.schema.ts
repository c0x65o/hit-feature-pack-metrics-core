import { z } from "zod";

// Schema-only module for:
// - PUT /api/metrics/segments/[key]

const segmentRuleSchema = z.object({
  kind: z.string().min(1),
}).passthrough(); // Allow additional properties

export const putBodySchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  rule: segmentRuleSchema.optional(),
  isActive: z.boolean().optional(),
});
