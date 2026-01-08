/**
 * metrics-runner
 *
 * Purpose: make it dead-simple to add custom metric scripts (Python/Node/anything)
 * while keeping ingestion standardized and task-module-friendly.
 *
 * Pattern:
 * - This runner is what you point a HIT task at (in hit.yaml).
 * - It runs your script/command.
 * - Your script prints JSON metric points to stdout.
 * - The runner POSTs those points to /api/metrics/ingest using X-HIT-Service-Token.
 *   (and includes the configured data source so the server can upsert it as part of ingestion).
 *
 * Example task command:
 *   HIT_APP_URL=http://localhost:3000 HIT_SERVICE_TOKEN=... \
 *   node node_modules/@hit/feature-pack-metrics-core/dist/cli/metrics-runner.js \
 *     --data-source-id ds_steam_sales_main \
 *     --entity-kind project --entity-id proj_123 \
 *     --connector-key file.steam.sales --source-kind file_upload \
 *     -- -- uv run --with "psycopg[binary]" python .hit/tasks/my-script-that-emits-points.py
 */
export {};
//# sourceMappingURL=metrics-runner.d.ts.map