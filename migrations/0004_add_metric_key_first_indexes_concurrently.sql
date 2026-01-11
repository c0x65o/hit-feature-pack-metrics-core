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

-- IMPORTANT:
-- This migration must contain EXACTLY ONE CONCURRENTLY statement.
-- The HIT Node migration runner executes each SQL file via a single query call; multiple
-- statements in one file would still run "inside a transaction block" and fail.

-- 1) metric_key-only filters / existence checks (fast path for computed metric fallback)
CREATE INDEX CONCURRENTLY IF NOT EXISTS metrics_metric_points_metric_key_idx
  ON metrics_metric_points (metric_key);

