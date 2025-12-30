import { z } from "zod";

// Schema-only module for:
// - POST /api/metrics/segments/table-buckets/evaluate

export const postBodySchema = z.object({
  tableId: z.string().min(1),
  columnKey: z.string().min(1),
  entityKind: z.string().min(1),
  entityIds: z.array(z.string()).max(500),
});

