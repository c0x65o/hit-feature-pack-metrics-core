-- Feature Pack: metrics-core
-- HIT: NONTRANSACTIONAL
--
-- IMPORTANT:
-- This migration must contain EXACTLY ONE CONCURRENTLY statement.

-- If an older metric_key+date index exists from previous maintenance work, drop it (redundant)
DROP INDEX CONCURRENTLY IF EXISTS metrics_metric_points_metric_key_date_idx;

