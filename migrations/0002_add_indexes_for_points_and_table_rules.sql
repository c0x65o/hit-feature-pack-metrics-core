-- Feature Pack: metrics-core
-- Performance indexes for metric point aggregation and table-linked segment/metric columns.
--
-- Primary hot paths today:
-- - Sum/agg metric points by (entity_kind, metric_key) over a date window, grouped by entity_id
-- - Discover table bucket/metric columns by rule.table.tableId + rule.table.columnKey (+ rule.kind)

-- ─────────────────────────────────────────────────────────────────────────────
-- metrics_metric_points
-- ─────────────────────────────────────────────────────────────────────────────

-- Filter by entity_kind + metric_key + date range (common for windowed sums)
CREATE INDEX IF NOT EXISTS metrics_metric_points_kind_key_date_idx
  ON metrics_metric_points (entity_kind, metric_key, date);

-- Filter by entity_kind + metric_key + date range and group by entity_id (common for per-entity rollups)
CREATE INDEX IF NOT EXISTS metrics_metric_points_kind_key_date_entity_idx
  ON metrics_metric_points (entity_kind, metric_key, date, entity_id);

-- Optimizes "last" rollups (partition by entity_id, order by date desc)
-- Postgres can use btree ordering; DESC here helps planner for ORDER BY ... DESC.
CREATE INDEX IF NOT EXISTS metrics_metric_points_kind_key_entity_date_desc_idx
  ON metrics_metric_points (entity_kind, metric_key, entity_id, date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- metrics_segments
-- ─────────────────────────────────────────────────────────────────────────────

-- Table-linked rules discovery for bucket columns and metric columns:
-- WHERE is_active=true AND entity_kind=? AND rule->>'kind'=? AND rule->'table'->>'tableId'=? AND rule->'table'->>'columnKey' ...
CREATE INDEX IF NOT EXISTS metrics_segments_table_rule_lookup_idx
  ON metrics_segments (
    is_active,
    entity_kind,
    ((rule ->> 'kind')),
    ((rule -> 'table' ->> 'tableId')),
    ((rule -> 'table' ->> 'columnKey'))
  );

