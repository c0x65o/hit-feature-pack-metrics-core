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
 * - The runner POSTs those points to /api/metrics/ingest using Authorization: Bearer.
 *   (and includes the configured data source so the server can upsert it as part of ingestion).
 *
 * Example task command:
 *   HIT_APP_URL=http://localhost:3000 HIT_BEARER_TOKEN=... \
 *   node node_modules/@hit/feature-pack-metrics-core/dist/cli/metrics-runner.js \
 *     --data-source-id ds_steam_sales_main \
 *     --entity-kind project --entity-id proj_123 \
 *     --connector-key file.steam.sales --source-kind file_upload \
 *     -- -- uv run --with "psycopg[binary]" python .hit/tasks/my-script-that-emits-points.py
 */

import { spawn } from 'node:child_process';

type RunnerArgs = {
  baseUrl: string;
  bearerToken: string;
  dataSourceId?: string;
  entityKind?: string;
  entityId?: string;
  connectorKey?: string;
  sourceKind?: string;
  externalRef?: string;
  command: string;
  commandArgs: string[];
};

type Point = {
  entityKind?: string;
  entityId?: string;
  metricKey: string;
  dataSourceId?: string;
  date: string;
  granularity?: string;
  value: number | string;
  dimensions?: Record<string, unknown> | null;
  syncRunId?: string | null;
  ingestBatchId?: string | null;
};

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed.bearerToken) {
    throw new Error('Missing bearer token. Set HIT_BEARER_TOKEN or pass --bearer-token');
  }
  if (!parsed.command) {
    throw new Error('Missing command. Use -- <command ...args>');
  }

  // Ensure DS exists if enough info provided
  let dataSourceId = parsed.dataSourceId;
  if (!dataSourceId) {
    throw new Error('Missing --data-source-id (required for now)');
  }

  const stdout = await runCommand(parsed.command, parsed.commandArgs, {
    ...process.env,
    HIT_METRICS_DATA_SOURCE_ID: dataSourceId,
    HIT_METRICS_ENTITY_KIND: parsed.entityKind || '',
    HIT_METRICS_ENTITY_ID: parsed.entityId || '',
  });

  const points = parsePoints(stdout);
  if (points.length === 0) {
    console.log('No points emitted by script.');
    return;
  }

  const normalized: Point[] = points.map((p) => ({
    ...p,
    dataSourceId: p.dataSourceId || dataSourceId,
    entityKind: p.entityKind || parsed.entityKind,
    entityId: p.entityId || parsed.entityId,
  }));

  // validate required fields
  for (const p of normalized) {
    if (!p.entityKind || !p.entityId || !p.dataSourceId) {
      throw new Error('Point missing entityKind/entityId/dataSourceId (runner could not fill them).');
    }
    if (!p.metricKey) throw new Error('Point missing metricKey');
    if (!p.date) throw new Error('Point missing date');
  }

  await ingestPoints(
    parsed.baseUrl,
    parsed.bearerToken,
    {
      id: dataSourceId,
      entityKind: parsed.entityKind,
      entityId: parsed.entityId,
      connectorKey: parsed.connectorKey,
      sourceKind: parsed.sourceKind,
      externalRef: parsed.externalRef,
      enabled: true,
    },
    normalized as RequiredPoint[],
  );
  console.log(`Ingested ${normalized.length} point(s).`);
}

type RequiredPoint = {
  entityKind: string;
  entityId: string;
  metricKey: string;
  dataSourceId: string;
  date: string;
  granularity?: string;
  value: number | string;
  dimensions?: Record<string, unknown> | null;
  syncRunId?: string | null;
  ingestBatchId?: string | null;
};

function parseArgs(argv: string[]): RunnerArgs {
  // Prefer HIT_APP_URL when explicitly set (internal cluster DNS), otherwise accept
  // HIT_APP_PUBLIC_URL which is injected by the app's tasks proxy for UI-triggered runs.
  const portGuess = process.env.PORT || '3002';
  const baseUrl =
    process.env.HIT_APP_URL ||
    process.env.HIT_APP_PUBLIC_URL ||
    `http://localhost:${portGuess}`;
  const bearerToken = process.env.HIT_BEARER_TOKEN || '';

  const out: Omit<RunnerArgs, 'command' | 'commandArgs'> & { command?: string; commandArgs?: string[] } = {
    baseUrl,
    bearerToken,
  };

  const sepIdx = argv.indexOf('--');
  const opts = sepIdx === -1 ? argv : argv.slice(0, sepIdx);
  const cmd = sepIdx === -1 ? [] : argv.slice(sepIdx + 1);

  for (let i = 0; i < opts.length; i++) {
    const a = opts[i];
    const next = () => {
      const v = opts[i + 1];
      if (!v) throw new Error(`Missing value for ${a}`);
      i++;
      return v;
    };

    if (a === '--base-url') out.baseUrl = next();
    else if (a === '--bearer-token') out.bearerToken = next();
    else if (a === '--data-source-id') out.dataSourceId = next();
    else if (a === '--entity-kind') out.entityKind = next();
    else if (a === '--entity-id') out.entityId = next();
    else if (a === '--connector-key') out.connectorKey = next();
    else if (a === '--source-kind') out.sourceKind = next();
    else if (a === '--external-ref') out.externalRef = next();
    else throw new Error(`Unknown arg: ${a}`);
  }

  return {
    baseUrl: out.baseUrl!,
    bearerToken: out.bearerToken!,
    dataSourceId: out.dataSourceId,
    entityKind: out.entityKind,
    entityId: out.entityId,
    connectorKey: out.connectorKey,
    sourceKind: out.sourceKind,
    externalRef: out.externalRef,
    command: cmd[0] || '',
    commandArgs: cmd.slice(1),
  };
}

async function ingestPoints(
  baseUrl: string,
  bearerToken: string,
  dataSource: {
    id: string;
    entityKind?: string;
    entityId?: string;
    connectorKey?: string;
    sourceKind?: string;
    externalRef?: string;
    enabled?: boolean;
  },
  points: RequiredPoint[],
) {
  if (!dataSource.entityKind || !dataSource.entityId || !dataSource.connectorKey || !dataSource.sourceKind) {
    throw new Error('Missing entityKind/entityId/connectorKey/sourceKind (required to ingest with dataSource).');
  }
  const authHeader = normalizeBearer(bearerToken);
  const res = await fetch(`${stripTrailingSlash(baseUrl)}/api/metrics/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      dataSource: {
        id: dataSource.id,
        entityKind: dataSource.entityKind,
        entityId: dataSource.entityId,
        connectorKey: dataSource.connectorKey,
        sourceKind: dataSource.sourceKind,
        externalRef: dataSource.externalRef,
        enabled: dataSource.enabled !== false,
      },
      points,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ingest failed (${res.status}): ${body}`);
  }
}

function parsePoints(stdout: string): Point[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  // 1) whole-output JSON: { points: [...] } or [...]
  try {
    const parsed = JSON.parse(trimmed) as any;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.points)) return parsed.points;
  } catch {
    // fall through
  }

  // 2) NDJSON lines
  const points: Point[] = [];
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as any;
      if (obj && typeof obj === 'object') points.push(obj);
    } catch {
      // ignore non-JSON lines (logs)
    }
  }
  return points;
}

function runCommand(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      process.stderr.write(d);
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) return resolve(stdout);
      reject(new Error(`Command failed (exit ${code}). Stderr:\n${stderr}`));
    });
  });
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


