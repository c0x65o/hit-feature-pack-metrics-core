import { z } from "zod";

// Schema-only module for:
// - PUT /api/metrics/links/[id]

export const putBodySchema = z.object({
  linkType: z.string().min(1).optional(),
  linkId: z.string().min(1).optional(),
  targetKind: z.string().optional(),
  targetId: z.string().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});
