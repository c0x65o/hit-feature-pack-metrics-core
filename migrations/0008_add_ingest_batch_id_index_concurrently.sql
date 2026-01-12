-- Feature Pack: metrics-core
-- HIT: NONTRANSACTIONAL
--
-- IMPORTANT:
-- This migration must contain EXACTLY ONE CONCURRENTLY statement.
--
-- Fast lookup by ingest_batch_id (repairs/maintenance, ingest drilldowns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS metrics_metric_points_ingest_batch_id_idx
  ON metrics_metric_points (ingest_batch_id)
  WHERE ingest_batch_id IS NOT NULL;

