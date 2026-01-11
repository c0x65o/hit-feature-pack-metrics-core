-- Feature Pack: metrics-core
-- HIT: NONTRANSACTIONAL
--
-- IMPORTANT:
-- This migration must contain EXACTLY ONE CONCURRENTLY statement.

-- Windowed queries + stable paging for /api/metrics/points
CREATE INDEX CONCURRENTLY IF NOT EXISTS metrics_metric_points_metric_key_date_id_idx
  ON metrics_metric_points (metric_key, date, id);

