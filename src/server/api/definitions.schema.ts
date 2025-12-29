import { z } from "zod";

// Schema-only module for:
// - POST /api/metrics/definitions

export const postBodySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  unit: z.string().optional().default("count"),
  category: z.string().nullable().optional(),
  defaultGranularity: z.string().optional().default("daily"),
  allowedGranularities: z.any().nullable().optional(),
  dimensionsSchema: z.any().nullable().optional(),
  validationRules: z.any().nullable().optional(),
  rollupStrategy: z.string().optional().default("sum"),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
});
