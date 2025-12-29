import { z } from "zod";

// Schema-only module for:
// - POST /api/metrics/ingestors/[id]/upload

// Note: This endpoint uses multipart/form-data, not JSON body
// The schema generator may not handle this correctly, but we'll define what we can
export const postBodySchema = z.object({
  file: z.instanceof(File).optional(), // File upload
  overwrite: z.string().optional(), // "true" or "false" as string
});
