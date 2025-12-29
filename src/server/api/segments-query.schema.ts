import { z } from "zod";

// Schema-only module for:
// - POST /api/metrics/segments/query

export const postBodySchema = z.object({
  segmentKey: z.string().min(1),
  entityKind: z.string().min(1),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(500).optional().default(50),
});
