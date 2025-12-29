import { z } from "zod";

// Schema-only module for:
// - POST /api/metrics/query

export const postBodySchema = z.object({
  metricKey: z.string().min(1),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  bucket: z.enum(["none", "hour", "day", "week", "month"]).optional().default("day"),
  agg: z.enum(["sum", "avg", "min", "max", "count", "last"]).optional().default("sum"),
  entityKind: z.string().optional(),
  entityId: z.string().optional(),
  entityIds: z.array(z.string()).optional(),
  dataSourceId: z.string().optional(),
  sourceGranularity: z.string().optional(),
  dimensions: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  groupBy: z.array(z.string()).optional(),
  groupByEntityId: z.boolean().optional(),
});
