import { z } from "zod";

// Schema-only module for:
// - POST /api/metrics/links

export const postBodySchema = z.object({
  linkType: z.string().min(1),
  linkId: z.string().min(1),
  targetKind: z.string().optional().default("none"),
  targetId: z.string().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});
