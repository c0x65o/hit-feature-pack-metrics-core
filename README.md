# @hit/feature-pack-metrics-core

Core metrics system for HIT:

- Metric definitions (`/api/metrics/definitions`)
- Data sources (`/api/metrics/data-sources`)
- Point ingestion with safe upserts (`/api/metrics/ingest`)
- Fast aggregation queries w/ bucketing & dimension filters (`/api/metrics/query`)
- A task-friendly CLI runner (`dist/cli/metrics-runner.js`) that lets you plug in *any* script language

## Installation

```bash
hit feature add metrics-core
```

Or manually:
1. Add to `hit.yaml` under `feature_packs:`
2. Add `"@hit/feature-pack-metrics-core": "github:c0x65o/hit-feature-pack-metrics-core"` to `package.json`
3. Add `'@hit/feature-pack-metrics-core'` to `hitPackages` array in `next.config.js`
4. Run `npm install`
5. Run `hit run` to generate routes

## Development

```bash
npm install
npm run build
```

## Task-module friendly “scripts that emit points” (recommended pattern)

### The idea

Instead of writing scripts that talk to Postgres directly, you write scripts that **print JSON points**.
Then the metrics-core runner ingests those points via the normal API using `X-HIT-Service-Token`.

### Runner (what you point a HIT task at)

Example task command (in `hit.yaml -> tasks:`):

```bash
HIT_APP_URL=http://localhost:3000 HIT_SERVICE_TOKEN=... \
node node_modules/@hit/feature-pack-metrics-core/dist/cli/metrics-runner.js \
  --data-source-id ds_steam_sales_main \
  --entity-kind project --entity-id proj_123 \
  --connector-key file.steam.sales --source-kind file_upload \
  -- \
  uv run --with "psycopg[binary]" python .hit/tasks/my-script-that-emits-points.py
```

### Script output contract

Your script can print either:

- A single JSON object: `{ "points": [ ... ] }`
- Or NDJSON (one JSON point per line)

Point shape:

```json
{
  "metricKey": "revenue_usd",
  "date": "2025-12-17T00:00:00Z",
  "value": 123.45,
  "granularity": "daily",
  "dimensions": { "platform": "steam", "country": "US" }
}
```

The runner will fill in `entityKind`, `entityId`, and `dataSourceId` for you (unless you provide them).
