import { z } from 'zod';
// Schema-only module for:
// - GET /api/metrics/points (query params) OR POST bodies if we later add POST support.
//
// NOTE: We keep this schema permissive on date formats, but the handler validates
// parseability into JS Date objects.
export const pointsQuerySchema = z.object({
    metricKey: z.string().min(1),
    start: z.string().optional(),
    end: z.string().optional(),
    entityKind: z.string().optional(),
    entityId: z.string().optional(),
    entityIds: z.array(z.string()).optional(),
    dataSourceId: z.string().optional(),
    dimensions: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    page: z.number().int().min(1).optional().default(1),
    pageSize: z.number().int().min(1).max(500).optional().default(50),
    order: z.enum(['date_desc', 'date_asc']).optional().default('date_desc'),
});
