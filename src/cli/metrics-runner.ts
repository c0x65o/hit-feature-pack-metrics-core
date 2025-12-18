/**
 * metrics-runner
 *
 * Purpose: make it dead-simple to add custom metric scripts (Python/Node/anything)
 * while keeping ingestion standardized and task-module-friendly.
 *
 * Pattern:
 * - This runner is what you point a HIT task at (in hit.yaml).
 * - It creates/ensures a Metrics Data Source exists (idempotent by id).
 * - It runs your script/command.
 * - Your script prints JSON metric points to stdout.
 * - The runner POSTs those points to /api/metrics/ingest using X-HIT-Service-Token.
 *
 * Example task command:
 *   HIT_APP_URL=http://localhost:3000 HIT_SERVICE_TOKEN=... \
 *   node node_modules/@hit/feature-pack-metrics-core/dist/cli/metrics-runner.js \
 *     --data-source-id ds_steam_sales_main \
 *     --entity-kind project --entity-id proj_123 \
 *     --connector-key file.steam.sales --source-kind file_upload \
 *     -- -- uv run --with "psycopg[binary]" python .hit/tasks/my-script-that-emits-points.py
 */

import { spawn } from 'node:child_process';

type RunnerArgs = {
  baseUrl: string;
  serviceToken: string;
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

  if (!parsed.serviceToken) {
    throw new Error('Missing service token. Set HIT_SERVICE_TOKEN or pass --service-token');
  }
  if (!parsed.command) {
    throw new Error('Missing command. Use -- <command ...args>');
  }

  // Ensure DS exists if enough info provided
  let dataSourceId = parsed.dataSourceId;
  if (!dataSourceId) {
    throw new Error('Missing --data-source-id (required for now)');
  }

  await ensureDataSource({
    baseUrl: parsed.baseUrl,
    serviceToken: parsed.serviceToken,
    id: dataSourceId,
    entityKind: parsed.entityKind,
    entityId: parsed.entityId,
    connectorKey: parsed.connectorKey,
    sourceKind: parsed.sourceKind,
    externalRef: parsed.externalRef,
  });

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

  await ingestPoints(parsed.baseUrl, parsed.serviceToken, normalized as RequiredPoint[]);
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
  const baseUrl = process.env.HIT_APP_URL || 'http://localhost:3000';
  const serviceToken = process.env.HIT_SERVICE_TOKEN || '';

  const out: Omit<RunnerArgs, 'command' | 'commandArgs'> & { command?: string; commandArgs?: string[] } = {
    baseUrl,
    serviceToken,
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
    else if (a === '--service-token') out.serviceToken = next();
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
    serviceToken: out.serviceToken!,
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

async function ensureDataSource(input: {
  baseUrl: string;
  serviceToken: string;
  id: string;
  entityKind?: string;
  entityId?: string;
  connectorKey?: string;
  sourceKind?: string;
  externalRef?: string;
}) {
  if (!input.entityKind || !input.entityId || !input.connectorKey || !input.sourceKind) {
    throw new Error('Missing entityKind/entityId/connectorKey/sourceKind (required to ensure data source).');
  }

  const res = await fetch(`${stripTrailingSlash(input.baseUrl)}/api/metrics/data-sources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HIT-Service-Token': input.serviceToken,
    },
    body: JSON.stringify({
      id: input.id,
      entityKind: input.entityKind,
      entityId: input.entityId,
      connectorKey: input.connectorKey,
      sourceKind: input.sourceKind,
      externalRef: input.externalRef,
      enabled: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to ensure data source (${res.status}): ${body}`);
  }
}

async function ingestPoints(baseUrl: string, token: string, points: RequiredPoint[]) {
  const res = await fetch(`${stripTrailingSlash(baseUrl)}/api/metrics/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HIT-Service-Token': token,
    },
    body: JSON.stringify({ points }),
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

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});


