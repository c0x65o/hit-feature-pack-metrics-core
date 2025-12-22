import { pgTable, varchar, timestamp, text, boolean, numeric, jsonb, unique } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// TABLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metrics Metric Definitions
 * The dictionary of allowed metric keys and how they should be aggregated/validated.
 */
export const metricsMetricDefinitions = pgTable('metrics_metric_definitions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(), // e.g., "revenue_usd", "wishlist_total"
  label: varchar('label', { length: 255 }).notNull(),
  description: text('description'),
  unit: varchar('unit', { length: 50 }).notNull().default('count'), // count, usd, percent, seconds, etc.
  category: varchar('category', { length: 50 }), // optional grouping: sales, engagement, etc.
  defaultGranularity: varchar('default_granularity', { length: 20 }).notNull().default('daily'),
  allowedGranularities: jsonb('allowed_granularities'), // ["hourly","daily","weekly","monthly"]
  dimensionsSchema: jsonb('dimensions_schema'), // { platform: { required: true }, country: { required: false } }
  validationRules: jsonb('validation_rules'), // { min: 0, max: null, required_dimensions: [] }
  rollupStrategy: varchar('rollup_strategy', { length: 20 }).notNull().default('sum'), // sum, avg, last, max, min
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: numeric('sort_order', { precision: 10, scale: 0 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Metrics Data Sources
 * Inventory of sync-able sources (connectors + config) that produce metric points.
 */
export const metricsDataSources = pgTable('metrics_data_sources', {
  id: varchar('id', { length: 255 }).primaryKey(),
  // Generic scoping (marketing uses project/game; this generalizes it)
  entityKind: varchar('entity_kind', { length: 50 }).notNull(), // e.g., "project", "game", "org", "account"
  entityId: varchar('entity_id', { length: 255 }).notNull(),

  connectorKey: varchar('connector_key', { length: 255 }).notNull(), // e.g., "storefront.steam.api", "file.steam.sales"
  sourceKind: varchar('source_kind', { length: 50 }).notNull(), // api, scrape, oauth, api_key, file_upload, manual
  externalRef: varchar('external_ref', { length: 500 }), // URL, handle, storeId, channelId, etc.
  enabled: boolean('enabled').notNull().default(true),

  // Scheduling metadata (actual scheduling is handled by the tasks module + hit.yaml)
  schedule: varchar('schedule', { length: 100 }), // cron or semantic schedule string (optional)

  // Connector-specific configuration blob
  config: jsonb('config'),
  overlapPolicy: varchar('overlap_policy', { length: 50 }).notNull().default('upsert_points'), // upsert_points, replace_range

  // Health columns
  lastAttemptAt: timestamp('last_attempt_at'),
  lastSuccessAt: timestamp('last_success_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastErrorCode: varchar('last_error_code', { length: 100 }),
  lastErrorMessage: text('last_error_message'),
  consecutiveFailures: numeric('consecutive_failures', { precision: 10, scale: 0 }).default('0'),

  // Freshness tracking
  expectedFreshnessSeconds: numeric('expected_freshness_seconds', { precision: 10, scale: 0 }),
  statusOverride: varchar('status_override', { length: 50 }),

  // Coverage tracking
  lastMetricDate: timestamp('last_metric_date'),
  firstMetricDate: timestamp('first_metric_date'),
  metricKeysProduced: jsonb('metric_keys_produced'), // ["revenue_usd","units_sold"]

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Metrics Sync Runs
 * Ledger correlating connector runs to outcomes (ties to task runs when available).
 */
export const metricsSyncRuns = pgTable('metrics_sync_runs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  dataSourceId: varchar('data_source_id', { length: 255 })
    .notNull()
    .references(() => metricsDataSources.id, { onDelete: 'cascade' }),
  taskRunId: varchar('task_run_id', { length: 255 }), // tasks module execution ID (optional)
  status: varchar('status', { length: 50 }).notNull(), // running, success, error, partial, action_required
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  warningsCount: numeric('warnings_count', { precision: 10, scale: 0 }).default('0'),
  recordsInserted: numeric('records_inserted', { precision: 10, scale: 0 }).default('0'),
  recordsUpdated: numeric('records_updated', { precision: 10, scale: 0 }).default('0'),
  recordsRejected: numeric('records_rejected', { precision: 10, scale: 0 }).default('0'),
  dateRangeStart: timestamp('date_range_start'),
  dateRangeEnd: timestamp('date_range_end'),
  actionsRequired: jsonb('actions_required'),
  logRef: varchar('log_ref', { length: 500 }),
  sampleRef: varchar('sample_ref', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Metrics Ingest Batches
 * Used for file/manual ingestion tracking and provenance.
 */
export const metricsIngestBatches = pgTable('metrics_ingest_batches', {
  id: varchar('id', { length: 255 }).primaryKey(),
  dataSourceId: varchar('data_source_id', { length: 255 })
    .notNull()
    .references(() => metricsDataSources.id, { onDelete: 'cascade' }),
  syncRunId: varchar('sync_run_id', { length: 255 }).references(() => metricsSyncRuns.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }).notNull(), // csv_upload, manual_entry, external_import
  period: varchar('period', { length: 20 }), // e.g., "2025-12"
  fileRef: varchar('file_ref', { length: 500 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: numeric('file_size', { precision: 15, scale: 0 }),
  mappingVersion: varchar('mapping_version', { length: 100 }),
  status: varchar('status', { length: 50 }).notNull(), // processing, success, error, rejected
  dateRangeStart: timestamp('date_range_start'),
  dateRangeEnd: timestamp('date_range_end'),
  recordsTotal: numeric('records_total', { precision: 10, scale: 0 }).default('0'),
  recordsInserted: numeric('records_inserted', { precision: 10, scale: 0 }).default('0'),
  recordsUpdated: numeric('records_updated', { precision: 10, scale: 0 }).default('0'),
  recordsRejected: numeric('records_rejected', { precision: 10, scale: 0 }).default('0'),
  errorMessage: text('error_message'),
  validationSummary: jsonb('validation_summary'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Metrics Ingest Row Errors
 * Stores why individual rows were rejected.
 */
export const metricsIngestRowErrors = pgTable('metrics_ingest_row_errors', {
  id: varchar('id', { length: 255 }).primaryKey(),
  ingestBatchId: varchar('ingest_batch_id', { length: 255 })
    .notNull()
    .references(() => metricsIngestBatches.id, { onDelete: 'cascade' }),
  rowNumber: numeric('row_number', { precision: 10, scale: 0 }).notNull(),
  errorCode: varchar('error_code', { length: 100 }).notNull(),
  errorMessage: text('error_message').notNull(),
  fieldName: varchar('field_name', { length: 100 }),
  rawRow: jsonb('raw_row'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Metrics Links
 * Global linking/metadata registry used by ingestors and tooling.
 *
 * Examples:
 * (Legacy example, no longer required for file-based ingestion)
 * - linkType="steam.app", linkId="276410", targetKind="project", targetId="ministry-of-broadcast"
 * - linkType="metrics.field_mapper", linkId="ministry of broadcast", targetKind="project", targetId="ministry-of-broadcast",
 *   metadata={ "steam_app_id": "276410" }
 */
export const metricsLinks = pgTable(
  'metrics_links',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    linkType: varchar('link_type', { length: 100 }).notNull(),
    linkId: varchar('link_id', { length: 255 }).notNull(),
    // Optional target: use ("none","") when not linked yet
    targetKind: varchar('target_kind', { length: 50 }).notNull().default('none'),
    targetId: varchar('target_id', { length: 255 }).notNull().default(''),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueLink: unique('metrics_links_unique').on(table.linkType, table.linkId, table.targetKind, table.targetId),
  }),
);

/**
 * Metrics Partner Credentials
 * Stores credentials + verification status for integration partners configured via `.hit/metrics/partners/*.yaml`.
 *
 * The partner "definition" lives in YAML; this table stores the per-app configured values.
 */
export const metricsPartnerCredentials = pgTable('metrics_partner_credentials', {
  // partner id (from YAML), e.g. "youtube-data-api", "steam-web-api"
  id: varchar('id', { length: 100 }).primaryKey(),

  enabled: boolean('enabled').notNull().default(true),
  credentials: jsonb('credentials').notNull().default({}),

  lastVerifiedAt: timestamp('last_verified_at'),
  lastVerifyOk: boolean('last_verify_ok'),
  lastVerifyMessage: text('last_verify_message'),
  lastVerifyDetails: jsonb('last_verify_details'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Metrics Metric Points
 * Normalized time-series points with full provenance and dimensions hashing for safe upserts.
 */
export const metricsMetricPoints = pgTable(
  'metrics_metric_points',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    // Scoping
    entityKind: varchar('entity_kind', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }).notNull(),

    metricKey: varchar('metric_key', { length: 100 }).notNull(),

    // Provenance
    dataSourceId: varchar('data_source_id', { length: 255 })
      .notNull()
      .references(() => metricsDataSources.id, { onDelete: 'cascade' }),
    syncRunId: varchar('sync_run_id', { length: 255 }).references(() => metricsSyncRuns.id, { onDelete: 'set null' }),
    ingestBatchId: varchar('ingest_batch_id', { length: 255 }).references(() => metricsIngestBatches.id, {
      onDelete: 'set null',
    }),

    // Temporal
    date: timestamp('date').notNull(), // "bucket timestamp" (date/time) depending on granularity
    granularity: varchar('granularity', { length: 20 }).notNull().default('daily'), // hourly, daily, weekly, monthly

    // Value
    value: numeric('value', { precision: 20, scale: 4 }).notNull(),

    // Dimensions
    dimensions: jsonb('dimensions'),
    dimensionsHash: varchar('dimensions_hash', { length: 64 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueMetricPoint: unique('metrics_metric_points_unique').on(
      table.dataSourceId,
      table.metricKey,
      table.date,
      table.granularity,
      table.dimensionsHash,
    ),
  }),
);

/**
 * Metrics Segments
 * A reusable classification/selection layer over entities (projects, users, etc.).
 *
 * NOTE:
 * - Segments are NOT metric points. They are rules that can be evaluated to:
 *   - check membership (boolean)
 *   - query matching entity ids (paged)
 */
export const metricsSegments = pgTable('metrics_segments', {
  id: varchar('id', { length: 255 }).primaryKey(),
  key: varchar('key', { length: 150 }).notNull().unique(), // e.g. "segment.project.revenue_gte_100k_all_time"
  entityKind: varchar('entity_kind', { length: 50 }).notNull(), // project, user, company, etc.
  label: varchar('label', { length: 255 }).notNull(),
  description: text('description'),
  rule: jsonb('rule').notNull(), // { kind: "...", ... } (resolver-specific)
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MetricsMetricDefinition = InferSelectModel<typeof metricsMetricDefinitions>;
export type InsertMetricsMetricDefinition = InferInsertModel<typeof metricsMetricDefinitions>;

export type MetricsDataSource = InferSelectModel<typeof metricsDataSources>;
export type InsertMetricsDataSource = InferInsertModel<typeof metricsDataSources>;

export type MetricsSyncRun = InferSelectModel<typeof metricsSyncRuns>;
export type InsertMetricsSyncRun = InferInsertModel<typeof metricsSyncRuns>;

export type MetricsIngestBatch = InferSelectModel<typeof metricsIngestBatches>;
export type InsertMetricsIngestBatch = InferInsertModel<typeof metricsIngestBatches>;

export type MetricsIngestRowError = InferSelectModel<typeof metricsIngestRowErrors>;
export type InsertMetricsIngestRowError = InferInsertModel<typeof metricsIngestRowErrors>;

export type MetricsLink = InferSelectModel<typeof metricsLinks>;
export type InsertMetricsLink = InferInsertModel<typeof metricsLinks>;

export type MetricsPartnerCredential = InferSelectModel<typeof metricsPartnerCredentials>;
export type InsertMetricsPartnerCredential = InferInsertModel<typeof metricsPartnerCredentials>;

export type MetricsMetricPoint = InferSelectModel<typeof metricsMetricPoints>;
export type InsertMetricsMetricPoint = InferInsertModel<typeof metricsMetricPoints>;

export type MetricsSegment = InferSelectModel<typeof metricsSegments>;
export type InsertMetricsSegment = InferInsertModel<typeof metricsSegments>;
