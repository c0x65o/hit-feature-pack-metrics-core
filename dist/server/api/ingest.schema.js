import { z } from "zod";
// Schema-only module for:
// - POST /api/metrics/ingest
const ingestPointSchema = z.object({
    entityKind: z.string().min(1),
    entityId: z.string().min(1),
    metricKey: z.string().min(1),
    dataSourceId: z.string().min(1),
    date: z.string(),
    granularity: z.string().optional(),
    value: z.union([z.number(), z.string()]),
    dimensions: z.record(z.string(), z.unknown()).nullable().optional(),
    syncRunId: z.string().nullable().optional(),
    ingestBatchId: z.string().nullable().optional(),
});
const ingestDataSourceSchema = z.object({
    id: z.string().min(1),
    entityKind: z.string().min(1),
    entityId: z.string().min(1),
    connectorKey: z.string().min(1),
    sourceKind: z.string().min(1),
    externalRef: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    schedule: z.string().nullable().optional(),
    config: z.unknown().optional(),
    overlapPolicy: z.string().optional(),
});
export const postBodySchema = z.object({
    points: z.array(ingestPointSchema).min(1),
    dataSource: ingestDataSourceSchema.optional(),
});
