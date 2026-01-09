-- Feature Pack: metrics-core
-- Additional performance indexes for:
-- 1) Table bucket discovery (segments with rule.table.tableId/columnKey but WITHOUT rule.kind filter)
-- 2) Project revenue "steam_app_id" fallback in segments-table-metrics (joins metrics_links.metadata + metrics_metric_points.dimensions)

-- ─────────────────────────────────────────────────────────────────────────────
-- metrics_segments
-- ─────────────────────────────────────────────────────────────────────────────
-- Used by:
--  - GET /api/metrics/segments/table-buckets?tableId=... (column discovery)
--  - GET /api/metrics/segments/table-buckets?tableId=...&columnKey=...
--
-- These queries filter on:
--  is_active=true AND entity_kind=? AND rule.table.tableId=? AND rule.table.columnKey (exists or equals)
-- But DO NOT filter on rule.kind (because bucket segments reuse their original rule kind, e.g. metric_threshold).
CREATE INDEX IF NOT EXISTS metrics_segments_table_bucket_lookup_idx
  ON metrics_segments (
    is_active,
    entity_kind,
    ((rule -> 'table' ->> 'tableId')),
    ((rule -> 'table' ->> 'columnKey')),
    key
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- metrics_links
-- ─────────────────────────────────────────────────────────────────────────────
-- Used by segments-table-metrics "steam_app_id" fallback join:
--  link_type='metrics.field_mapper'
--  metadata->>'project_slug' = projects.slug
--  metadata->>'steam_app_id' is present
CREATE INDEX IF NOT EXISTS metrics_links_field_mapper_project_slug_steam_app_id_idx
  ON metrics_links (
    link_type,
    ((metadata ->> 'project_slug')),
    ((metadata ->> 'steam_app_id'))
  )
  WHERE link_type = 'metrics.field_mapper';

-- ─────────────────────────────────────────────────────────────────────────────
-- metrics_metric_points
-- ─────────────────────────────────────────────────────────────────────────────
-- Used by segments-table-metrics "steam_app_id" fallback join:
--  metric_key=?
--  (dimensions->>'steam_app_id') = (metrics_links.metadata->>'steam_app_id')
--  date range optional
CREATE INDEX IF NOT EXISTS metrics_metric_points_metric_key_steam_app_id_date_idx
  ON metrics_metric_points (
    metric_key,
    ((dimensions ->> 'steam_app_id')),
    date
  );

