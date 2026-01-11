-- Feature Pack: metrics-core
-- HIT: NONTRANSACTIONAL
--
-- IMPORTANT:
-- This migration must contain EXACTLY ONE CONCURRENTLY statement.

-- Repair/maintenance joins by ingest_batch_id + metric_key
CREATE INDEX CONCURRENTLY IF NOT EXISTS metrics_metric_points_ingest_batch_metric_key_idx
  ON metrics_metric_points (ingest_batch_id, metric_key)
  WHERE ingest_batch_id IS NOT NULL;

