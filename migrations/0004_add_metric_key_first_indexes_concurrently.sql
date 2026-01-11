-- Feature Pack: metrics-core
-- HIT: NONTRANSACTIONAL
--
-- Why:
-- The hottest query paths in metrics-core start with metric_key (often without entity_kind),
-- and /api/metrics/points also pages with ORDER BY date_{asc|desc}, id desc.
-- On large tables this needs metric-key-first indexes.
--
-- Important:
-- - CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction block.
-- - HIT runners treat files containing `-- HIT: NONTRANSACTIONAL` as non-transactional.

-- 1) metric_key-only filters / existence checks (fast path for computed metric fallback)
CREATE INDEX CONCURRENTLY IF NOT EXISTS metrics_metric_points_metric_key_idx
  ON metrics_metric_points (metric_key);

-- 2) Windowed queries + stable paging for /api/metrics/points
CREATE INDEX CONCURRENTLY IF NOT EXISTS metrics_metric_points_metric_key_date_id_idx
  ON metrics_metric_points (metric_key, date, id);

-- 3) If an older metric_key+date index exists from previous maintenance work, drop it (redundant)
DROP INDEX CONCURRENTLY IF EXISTS metrics_metric_points_metric_key_date_idx;

-- 4) Repair/maintenance joins by ingest_batch_id + metric_key
CREATE INDEX CONCURRENTLY IF NOT EXISTS metrics_metric_points_ingest_batch_metric_key_idx
  ON metrics_metric_points (ingest_batch_id, metric_key)
  WHERE ingest_batch_id IS NOT NULL;

