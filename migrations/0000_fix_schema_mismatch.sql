-- Feature Pack: metrics-core
-- Purpose: Repair legacy schema placement where metrics-core tables were created under a
-- schema named after the database (e.g. hit_dashboard) instead of the per-project schema
-- (current_schema()).
--
-- This is safe/idempotent:
-- - If tables already exist in current_schema(), it does nothing.
-- - If tables exist in hit_dashboard schema and not in current_schema(), it moves them.
--
-- Why this exists:
-- - Many feature-pack SQL seeds reference tables like metrics_segments without schema qualifiers.
-- - HIT uses search_path=<project_schema>,public; if tables live in hit_dashboard schema, seeds fail.

DO $$
DECLARE
  src_schema text := 'hit_dashboard';
  dst_schema text := current_schema();
  t text;
  tables text[] := ARRAY[
    'metrics_metric_definitions',
    'metrics_data_sources',
    'metrics_sync_runs',
    'metrics_ingest_batches',
    'metrics_ingest_row_errors',
    'metrics_links',
    'metrics_partner_credentials',
    'metrics_metric_points',
    'metrics_segments'
  ];
BEGIN
  -- Only attempt repair when the legacy schema exists.
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = src_schema) THEN
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    -- If table exists in destination schema, leave it alone.
    IF to_regclass(format('%I.%I', dst_schema, t)) IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- If table exists in source schema, move it into destination schema.
    IF to_regclass(format('%I.%I', src_schema, t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I SET SCHEMA %I;', src_schema, t, dst_schema);
    END IF;
  END LOOP;
END $$;

