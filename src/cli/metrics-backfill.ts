/**
 * metrics-backfill (generic)
 *
 * Reads `metrics.definitions` + `metrics.backfills` from the app's hit.yaml (cwd)
 * and executes a named backfill via metrics-runner.
 *
 * This is intentionally app-agnostic so every app can keep its scripts in `.hit/tasks/`
 * and its configuration in `hit.yaml`, while metrics-core provides the standardized
 * ingestion + registry behavior.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as yaml from 'js-yaml';

type MetricsDefinitionConfig = {
  label: string;
  unit?: string;
  category?: string;
  description?: string;
  rollup_strategy?: 'sum' | 'avg' | 'min' | 'max' | 'last';
  default_granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
};

type MetricsBackfillConfig = {
  data_source_id: string;
  entity_kind: string;
  entity_id: string;
  connector_key: string;
  source_kind: string;
  external_ref?: string;
  command: string; // executed via: bash -lc "<command>"
};

type HitYaml = {
  metrics?: {
    definitions?: Record<string, MetricsDefinitionConfig>;
    backfills?: Record<string, MetricsBackfillConfig>;
  };
};

function parseArgs(argv: string[]) {
  const nameArg = argv.find((a) => a.startsWith('--name='));
  const name = nameArg ? nameArg.split('=')[1] : null;
  if (!name) {
    throw new Error('Missing --name=<backfillName>');
  }
  return { name };
}

function buildAuthHeaders(input: { bearerToken?: string; serviceToken?: string }): Record<string, string> {
  const serviceToken = String(input.serviceToken || '').trim();
  const bearer = normalizeBearer(serviceToken || String(input.bearerToken || ''));
  if (bearer) return { Authorization: bearer };
  return {};
}

async function ensureDefinitions(
  baseUrl: string,
  auth: { bearerToken?: string; serviceToken?: string },
  defs: Record<string, MetricsDefinitionConfig>,
) {
  for (const [key, cfg] of Object.entries(defs)) {
    const res = await fetch(`${stripTrailingSlash(baseUrl)}/api/metrics/definitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(auth),
      },
      body: JSON.stringify({
        key,
        label: cfg.label,
        unit: cfg.unit || 'count',
        category: cfg.category,
        description: cfg.description,
        rollupStrategy: cfg.rollup_strategy || 'sum',
        defaultGranularity: cfg.default_granularity || 'daily',
      }),
    });

    if (res.status === 409) continue; // already exists
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to ensure metric definition "${key}" (${res.status}): ${body}`);
    }
  }
}

function runBackfill(
  baseUrl: string,
  auth: { bearerToken?: string; serviceToken?: string },
  cfg: MetricsBackfillConfig,
) {
  const runnerPath = path.join(process.cwd(), 'node_modules', '@hit', 'feature-pack-metrics-core', 'dist', 'cli', 'metrics-runner.js');
  if (!fs.existsSync(runnerPath)) {
    throw new Error(`metrics-runner not found at ${runnerPath}. Did you npm install?`);
  }

  const args = [
    runnerPath,
    '--base-url',
    baseUrl,
    '--data-source-id',
    cfg.data_source_id,
    '--entity-kind',
    cfg.entity_kind,
    '--entity-id',
    cfg.entity_id,
    '--connector-key',
    cfg.connector_key,
    '--source-kind',
    cfg.source_kind,
  ];

  if (cfg.external_ref) {
    args.push('--external-ref', cfg.external_ref);
  }

  const bearerToken = String(auth.bearerToken || '').trim();
  const serviceToken = String(auth.serviceToken || '').trim();
  if (serviceToken) args.splice(3, 0, '--service-token', serviceToken);
  else if (bearerToken) args.splice(3, 0, '--bearer-token', bearerToken);
  else throw new Error('Missing auth token for metrics-runner');

  args.push('--', 'bash', '-lc', cfg.command);

  const result = spawnSync('node', args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    throw new Error(`metrics-runner failed with exit code ${result.status}`);
  }
}

export async function main() {
  const { name } = parseArgs(process.argv.slice(2));

  const bearerToken = process.env.HIT_BEARER_TOKEN || '';
  const serviceToken = process.env.HIT_SERVICE_TOKEN || '';
  if (!String(bearerToken).trim() && !String(serviceToken).trim()) {
    throw new Error(
      'Missing auth token. Set HIT_BEARER_TOKEN or HIT_SERVICE_TOKEN (recommended for background jobs).',
    );
  }

  // Prefer HIT_APP_URL when explicitly set (internal cluster DNS), otherwise accept
  // HIT_APP_PUBLIC_URL which is injected by the app's tasks proxy for UI-triggered runs.
  const portGuess = process.env.PORT || '3002';
  const baseUrl =
    process.env.HIT_APP_URL ||
    process.env.HIT_APP_PUBLIC_URL ||
    `http://localhost:${portGuess}`;

  const hitYamlPath = path.join(process.cwd(), 'hit.yaml');
  const hitYamlRaw = fs.readFileSync(hitYamlPath, 'utf8');
  const cfg = (yaml.load(hitYamlRaw) as HitYaml) || {};

  const backfill = cfg.metrics?.backfills?.[name];
  if (!backfill) throw new Error(`Backfill not found: metrics.backfills.${name}`);

  const defs = cfg.metrics?.definitions || {};
  if (Object.keys(defs).length > 0) {
    await ensureDefinitions(baseUrl, { bearerToken, serviceToken }, defs);
  }

  runBackfill(baseUrl, { bearerToken, serviceToken }, backfill);
}

function stripTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function normalizeBearer(raw: string): string {
  const token = String(raw || '').trim();
  if (!token) return '';
  return token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});


