import { z } from 'zod';

const dimensionsSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const drilldownSchema = z.object({
  // Either provide baseQuery + rowContext (from clicking an aggregate row),
  // or provide pointFilter directly.
  baseQuery: z
    .object({
      metricKey: z.string().min(1),
      start: z.string().optional(),
      end: z.string().optional(),
      bucket: z.enum(['none', 'hour', 'day', 'week', 'month']).optional().default('day'),
      agg: z.enum(['sum', 'avg', 'min', 'max', 'count', 'last']).optional().default('sum'),
      entityKind: z.string().optional(),
      entityId: z.string().optional(),
      entityIds: z.array(z.string()).optional(),
      dataSourceId: z.string().optional(),
      sourceGranularity: z.string().optional(),
      dimensions: dimensionsSchema.optional(),
      groupBy: z.array(z.string()).optional(),
      groupByEntityId: z.boolean().optional(),
    })
    .optional(),
  rowContext: z
    .object({
      // For bucketed queries, this should be the bucket timestamp returned from query (ISO string).
      bucket: z.string().optional(),
      // For groupByEntityId=true, the clicked entityId.
      entityId: z.string().optional(),
      // For groupBy dimensions, the clicked row’s dimension values (for the groupBy keys).
      dimensions: dimensionsSchema.optional(),
    })
    .optional(),
  pointFilter: z
    .object({
      metricKey: z.string().min(1),
      start: z.string().optional(),
      end: z.string().optional(),
      entityKind: z.string().optional(),
      entityId: z.string().optional(),
      entityIds: z.array(z.string()).optional(),
      dataSourceId: z.string().optional(),
      sourceGranularity: z.string().optional(),
      dimensions: dimensionsSchema.optional(),
    })
    .optional(),

  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(500).optional().default(50),
  includeContributors: z.boolean().optional().default(true),
});

