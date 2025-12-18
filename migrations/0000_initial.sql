-- metrics-core initial schema

CREATE TABLE IF NOT EXISTS metrics_metric_definitions (
  id VARCHAR(255) PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) NOT NULL DEFAULT 'count',
  category VARCHAR(50),
  default_granularity VARCHAR(20) NOT NULL DEFAULT 'daily',
  allowed_granularities JSONB,
  dimensions_schema JSONB,
  validation_rules JSONB,
  rollup_strategy VARCHAR(20) NOT NULL DEFAULT 'sum',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order NUMERIC(10, 0) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics_data_sources (
  id VARCHAR(255) PRIMARY KEY,
  entity_kind VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  connector_key VARCHAR(255) NOT NULL,
  source_kind VARCHAR(50) NOT NULL,
  external_ref VARCHAR(500),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule VARCHAR(100),
  config JSONB,
  overlap_policy VARCHAR(50) NOT NULL DEFAULT 'upsert_points',
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_code VARCHAR(100),
  last_error_message TEXT,
  consecutive_failures NUMERIC(10, 0) DEFAULT 0,
  expected_freshness_seconds NUMERIC(10, 0),
  status_override VARCHAR(50),
  last_metric_date TIMESTAMPTZ,
  first_metric_date TIMESTAMPTZ,
  metric_keys_produced JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics_sync_runs (
  id VARCHAR(255) PRIMARY KEY,
  data_source_id VARCHAR(255) NOT NULL REFERENCES metrics_data_sources(id) ON DELETE CASCADE,
  task_run_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error_code VARCHAR(100),
  error_message TEXT,
  warnings_count NUMERIC(10, 0) DEFAULT 0,
  records_inserted NUMERIC(10, 0) DEFAULT 0,
  records_updated NUMERIC(10, 0) DEFAULT 0,
  records_rejected NUMERIC(10, 0) DEFAULT 0,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  actions_required JSONB,
  log_ref VARCHAR(500),
  sample_ref VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics_ingest_batches (
  id VARCHAR(255) PRIMARY KEY,
  data_source_id VARCHAR(255) NOT NULL REFERENCES metrics_data_sources(id) ON DELETE CASCADE,
  sync_run_id VARCHAR(255) REFERENCES metrics_sync_runs(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  period VARCHAR(20),
  file_ref VARCHAR(500),
  file_name VARCHAR(255),
  file_size NUMERIC(15, 0),
  mapping_version VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  records_total NUMERIC(10, 0) DEFAULT 0,
  records_inserted NUMERIC(10, 0) DEFAULT 0,
  records_updated NUMERIC(10, 0) DEFAULT 0,
  records_rejected NUMERIC(10, 0) DEFAULT 0,
  error_message TEXT,
  validation_summary JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics_ingest_row_errors (
  id VARCHAR(255) PRIMARY KEY,
  ingest_batch_id VARCHAR(255) NOT NULL REFERENCES metrics_ingest_batches(id) ON DELETE CASCADE,
  row_number NUMERIC(10, 0) NOT NULL,
  error_code VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  field_name VARCHAR(100),
  raw_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics_metric_points (
  id VARCHAR(255) PRIMARY KEY,
  entity_kind VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  metric_key VARCHAR(100) NOT NULL,
  data_source_id VARCHAR(255) NOT NULL REFERENCES metrics_data_sources(id) ON DELETE CASCADE,
  sync_run_id VARCHAR(255) REFERENCES metrics_sync_runs(id) ON DELETE SET NULL,
  ingest_batch_id VARCHAR(255) REFERENCES metrics_ingest_batches(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL,
  granularity VARCHAR(20) NOT NULL DEFAULT 'daily',
  value NUMERIC(20, 4) NOT NULL,
  dimensions JSONB,
  dimensions_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT metrics_metric_points_unique UNIQUE (data_source_id, metric_key, date, granularity, dimensions_hash)
);

-- Helpful indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_metrics_points_metric_date ON metrics_metric_points(metric_key, date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_points_entity_metric_date ON metrics_metric_points(entity_kind, entity_id, metric_key, date DESC);

