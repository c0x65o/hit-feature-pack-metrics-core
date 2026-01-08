/**
 * metrics-ingestor-backfill (generic)
 *
 * Reads an ingestor config from the app repo:
 *   .hit/metrics/ingestors/<id>.yaml
 *
 * For directory backfills, it will:
 * - list matching files in the configured directory
 * - (optionally) validate required mappings exist in metrics_links
 * - POST each file to: /api/metrics/ingestors/<id>/upload (multipart)
 *   using X-HIT-Service-Token
 *
 * This keeps metrics-core dumb about CSV formats while still providing the
 * "heavy lifting" orchestration: discovery, validation, and execution.
 */
export declare function main(): Promise<void>;
//# sourceMappingURL=metrics-ingestor-backfill.d.ts.map