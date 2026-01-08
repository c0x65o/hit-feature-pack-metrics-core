import { z } from "zod";
// Schema-only module for:
// - PUT /api/metrics/partners/[id]
export const putBodySchema = z.object({
    enabled: z.boolean().optional(),
    credentials: z.record(z.string(), z.unknown()).optional(),
});
