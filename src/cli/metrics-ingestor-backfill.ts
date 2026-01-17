/**
 * metrics-ingestor-backfill (generic)
 *
 * Reads an ingestor config from the app repo:
 *   .hit/metrics/ingestors/<id>.yaml
 *
 * For directory backfills, it will:
 * - list matching files in the configured directory
 * - (optionally) validate required mappings exist in metrics_links
 * - POST each file to: /api/metrics/ingestors/<id>/upload (multipart)
 *   using Authorization: Bearer
 *
 * This keeps metrics-core dumb about CSV formats while still providing the
 * "heavy lifting" orchestration: discovery, validation, and execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

function resolveProjectSchemaName(): string {
  const slug = String(process.env.HIT_PROJECT_SLUG || process.env.NEXT_PUBLIC_HIT_PROJECT_SLUG || '').trim();
  if (slug) return slug.replace(/-/g, '_');
  const cwdBase = path.basename(process.cwd() || '').trim();
  if (cwdBase) return cwdBase.replace(/-/g, '_');
  return '';
}

function normalizeDatabaseUrl(raw: string): string {
  // Normalize DATABASE_URL: strip SQLAlchemy driver suffix (e.g., postgresql+psycopg://)
  // node-postgres expects plain postgresql://
  const normalized = String(raw || '')
    .trim()
    .replace(/^postgresql\+\w+:\/\//, 'postgresql://')
    .replace(/^postgres:\/\//, 'postgresql://');

  if (!normalized) return normalized;

  // Ensure search_path is set when using schema-isolated databases.
  // This keeps CLI validation consistent with app/drizzle schema usage.
  try {
    const url = new URL(normalized);
    const options = url.searchParams.get('options') || '';
    const hasSearchPath = /search_path[=,]/i.test(options);
    if (hasSearchPath) return normalized;

    const schemaName = resolveProjectSchemaName();
    if (!schemaName) return normalized;

    const nextOptions = options ? `${options} -csearch_path=${schemaName},public` : `-csearch_path=${schemaName},public`;
    url.searchParams.set('options', nextOptions);
    return url.toString();
  } catch {
    return normalized;
  }
}

type ServiceTokensFile = Record<string, string>;

function loadServiceTokensFromFile(): ServiceTokensFile | null {
  const p = path.join(process.cwd(), '.hit', 'service_tokens.json');
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ServiceTokensFile;
  } catch {
    return null;
  }
}

function resolveServiceToken(): string {
  const envToken = String(process.env.HIT_SERVICE_TOKEN || '').trim();
  if (envToken) return envToken;
  const tokens = loadServiceTokensFromFile();
  if (!tokens) return '';
  const serviceName = String(process.env.HIT_SERVICE_NAME || '').trim();
  if (serviceName && typeof tokens[serviceName] === 'string') return String(tokens[serviceName] || '').trim();
  if (typeof tokens.web === 'string') return String(tokens.web || '').trim();
  const first = Object.values(tokens).find((v) => typeof v === 'string' && String(v).trim());
  return first ? String(first).trim() : '';
}

type IngestorYaml = {
  id: string;
  label?: string;
  upload?: {
    enabled?: boolean;
    mapping?: {
      kind?: string;
      link_type?: string;
      key?: string;
    };
  };
  backfill?: {
    enabled?: boolean;
    kind?: 'directory';
    dir?: string;
    pattern?: string;
    validate_mappings?: boolean;
  };
};

type Args = {
  id: string;
  baseUrl: string;
  bearerToken: string;
  serviceToken: string;
  dryRun: boolean;
  validateOnly: boolean;
  overwrite: boolean;
  failFast: boolean;
};

function buildAuthHeaders(args: Pick<Args, 'bearerToken' | 'serviceToken'>): Record<string, string> {
  const serviceToken = String(args.serviceToken || '').trim();
  const bearer = normalizeBearer(serviceToken || args.bearerToken);
  if (bearer) return { Authorization: bearer };
  return {};
}

function parseArgs(argv: string[]): Args {
  // Prefer HIT_APP_URL when explicitly set, otherwise fall back to HIT_APP_PUBLIC_URL,
  // and finally localhost on the common Next port.
  const portGuess = process.env.PORT || '3002';
  const baseUrl =
    process.env.HIT_APP_URL ||
    process.env.HIT_APP_PUBLIC_URL ||
    `http://localhost:${portGuess}`;
  const bearerToken = process.env.HIT_BEARER_TOKEN || '';
  const serviceToken = resolveServiceToken();

  const out: Args = {
    id: '',
    baseUrl,
    bearerToken,
    serviceToken,
    dryRun: false,
    validateOnly: false,
    // Backfills are intended to be re-runnable and to repair stale/incorrect ingests.
    // Default to overwrite=true so production can recover without manual DB wipes.
    overwrite: true,
    // Default to continuing so a single bad/large file doesn't prevent the rest of the backfill.
    // The process will still exit non-zero if any upload fails.
    failFast: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (!v) throw new Error(`Missing value for ${a}`);
      i++;
      return v;
    };

    if (a === '--id') out.id = next();
    else if (a.startsWith('--id=')) out.id = a.split('=')[1] || '';
    else if (a === '--base-url') out.baseUrl = next();
    else if (a === '--bearer-token') out.bearerToken = next();
    else if (a === '--service-token') out.serviceToken = next();
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--validate-only') out.validateOnly = true;
    else if (a === '--overwrite') out.overwrite = true;
    else if (a === '--fail-fast') out.failFast = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  if (!out.id.trim()) throw new Error('Missing --id <ingestorId>');
  if (!String(out.bearerToken || '').trim() && !String(out.serviceToken || '').trim()) {
    throw new Error(
      'Missing auth token. Set HIT_BEARER_TOKEN or HIT_SERVICE_TOKEN (recommended for background jobs), or pass --bearer-token / --service-token',
    );
  }
  return out;
}

function stripTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function normalizeBearer(raw: string): string {
  const token = String(raw || '').trim();
  if (!token) return '';
  return token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function looksLikeNextTransientHtml(body: string): boolean {
  const b = (body || '').toLowerCase();
  return (
    b.includes('<!doctype html') ||
    b.includes('<html') ||
    b.includes('page not found') ||
    b.includes('missing required error components') ||
    b.includes('refreshing')
  );
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: { retries?: number; baseDelayMs?: number },
): Promise<{ res: Response; bodyText: string }> {
  const retries = Math.max(0, opts?.retries ?? 6);
  const baseDelayMs = Math.max(50, opts?.baseDelayMs ?? 250);

  let lastRes: Response | null = null;
  let lastBody = '';
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      const bodyText = await res.text().catch(() => '');
      lastRes = res;
      lastBody = bodyText;

      if (res.ok) return { res, bodyText };

      const transient =
        (res.status === 404 || res.status === 500 || res.status === 502 || res.status === 503) && looksLikeNextTransientHtml(bodyText);
      if (!transient) return { res, bodyText };
    } catch (e) {
      lastErr = e;
    }

    if (attempt < retries) {
      // Cap backoff so dev-server rebuilds can be waited out without turning into multi-minute sleeps.
      await sleep(Math.min(baseDelayMs * (attempt + 1), 2000));
    }
  }

  if (lastRes) return { res: lastRes, bodyText: lastBody };
  const err = lastErr instanceof Error ? lastErr : new Error(String(lastErr || 'fetch failed'));
  const method = (init?.method || 'GET').toUpperCase();
  const wrapped = new Error(
    [
      `Network error calling ${method} ${url} after ${retries + 1} attempt(s).`,
      `This usually means the app service restarted (OOM/liveness) or the connection was dropped during a long ingest.`,
      `Original error: ${err.message}`,
    ].join('\n'),
  );
  // TS-safe "cause" attachment (avoids relying on newer ErrorOptions typings/runtime).
  (wrapped as any).cause = err;
  throw wrapped;
}

function ingestorYamlPath(ingestorId: string) {
  // Schema-first (apps increasingly keep configs in schema/ and generate .hit at build time).
  const schemaPath = path.join(process.cwd(), 'schema', 'metrics', 'ingestors', `${ingestorId}.yaml`);
  if (fs.existsSync(schemaPath)) return schemaPath;

  // Legacy runtime config dir.
  return path.join(process.cwd(), '.hit', 'metrics', 'ingestors', `${ingestorId}.yaml`);
}

function loadIngestorOrThrow(ingestorId: string): IngestorYaml {
  const p = ingestorYamlPath(ingestorId);
  if (!fs.existsSync(p)) throw new Error(`Ingestor config not found: ${p}`);
  const raw = fs.readFileSync(p, 'utf8');
  const cfg = (yaml.load(raw) as IngestorYaml) || ({} as any);
  if (!cfg.id) cfg.id = ingestorId;
  return cfg;
}

function globToRegex(pattern: string): RegExp {
  // Very small glob implementation for "*"
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = '^' + escaped.replace(/\*/g, '.*') + '$';
  return new RegExp(re);
}

function listFiles(dirAbs: string, pattern: string): string[] {
  const re = globToRegex(pattern);
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && re.test(e.name))
    .map((e) => path.join(dirAbs, e.name))
    .sort((a, b) => a.localeCompare(b));
}

function missingMappingsError(linkType: string, missing: string[]) {
  return new Error(
    `Missing required metrics_links mappings for ${missing.length} file(s).\n` +
      `Expected link_type="${linkType}" and link_id to match filenames exactly.\n` +
      `If these should be seeded, run the app seed task (hit run task seed) or hit db seed --yes.\n` +
      missing.map((m) => `- ${m}`).join('\n'),
  );
}

async function validateMappingsViaApi(args: Args, linkType: string, fileNames: string[]) {
  const missing: string[] = [];
  for (const name of fileNames) {
    const url = `${stripTrailingSlash(args.baseUrl)}/api/metrics/links?linkType=${encodeURIComponent(linkType)}&q=${encodeURIComponent(name)}&limit=500`;
    const { res, bodyText } = await fetchWithRetry(
      url,
      { method: 'GET', headers: buildAuthHeaders(args) },
      { retries: 20, baseDelayMs: 300 },
    );
    if (!res.ok) {
      // Next dev server can temporarily return HTML 404/500 while recompiling.
      // In that case, skip validation and let the upload step be the source of truth.
      if (looksLikeNextTransientHtml(bodyText)) {
        console.warn(
          `Warning: skipping mapping validation because ${url} returned ${res.status} during a transient Next build/reload.\n` +
            `Uploads will still enforce mapping targets server-side.`,
        );
        return { missing: [], skipped: true };
      }
      // This usually indicates the app server isn't running (or its dev build is broken),
      // because this CLI relies on the app's API endpoints.
      throw new Error(
        `Mapping validation failed (${res.status}) for ${url}\n` +
          `Make sure the hit-dashboard web server is running and healthy, then re-run this task.\n` +
          `Response body:\n${bodyText}`,
      );
    }
    const json = (() => {
      try {
        return JSON.parse(bodyText);
      } catch {
        return null;
      }
    })() as any;
    const rows = Array.isArray(json?.data) ? (json.data as Array<{ linkId?: string }>) : [];
    const exact = rows.some((r) => r?.linkId === name);
    if (!exact) missing.push(name);
  }

  return { missing, skipped: false };
}

async function validateMappings(args: Args, cfg: IngestorYaml, fileNames: string[]) {
  const mapping = cfg.upload?.mapping;
  if (!mapping || mapping.kind !== 'metrics_links') return;
  const linkType = mapping.link_type;
  if (!linkType) return;

  // For now, only enforce mapping validation for exact_filename (or omitted).
  const mappingKey = mapping.key || 'exact_filename';
  if (mappingKey !== 'exact_filename') return;

  // New simplified path: if we have DATABASE_URL, validate against the DB directly.
  // This avoids depending on auth/scope/token plumbing for local jobs.
  const dbUrl = normalizeDatabaseUrl(process.env.DATABASE_URL || '');
  if (dbUrl) {
    let pg: any = null;
    try {
      pg = require('pg');
    } catch {
      pg = null;
    }
    if (pg?.Client) {
      const client = new pg.Client({ connectionString: dbUrl });
      await client.connect();
      try {
        // Check existence in chunks (Postgres has parameter limits; keep it safe).
        const have = new Set<string>();
        const chunkSize = 500;
        for (let i = 0; i < fileNames.length; i += chunkSize) {
          const chunk = fileNames.slice(i, i + chunkSize);
          const res = await client.query(
            `select link_id from metrics_links where link_type = $1 and link_id = any($2::text[])`,
            [linkType, chunk],
          );
          for (const r of res?.rows || []) {
            const id = String(r?.link_id || '').trim();
            if (id) have.add(id);
          }
        }
        const missing = fileNames.filter((n) => !have.has(n));
        if (missing.length > 0) {
          const api = await validateMappingsViaApi(args, linkType, missing);
          if (!api.skipped && api.missing.length > 0) {
            throw missingMappingsError(linkType, api.missing);
          }
        }
        return;
      } finally {
        await client.end().catch(() => {});
      }
    }
  }

  const api = await validateMappingsViaApi(args, linkType, fileNames);
  if (api.skipped) return;
  if (api.missing.length > 0) {
    throw missingMappingsError(linkType, api.missing);
  }
}

async function uploadOne(args: Args, ingestorId: string, filePath: string) {
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);

  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'text/csv' }), name);
  if (args.overwrite) form.append('overwrite', 'true');

  const url = `${stripTrailingSlash(args.baseUrl)}/api/metrics/ingestors/${encodeURIComponent(ingestorId)}/upload`;
  const { res, bodyText: text } = await fetchWithRetry(
    url,
    { method: 'POST', headers: buildAuthHeaders(args), body: form },
    { retries: 20, baseDelayMs: 400 },
  );
  if (!res.ok) {
    // Try to surface correlationId / structured error details for easier debugging in production.
    const parsed = (() => {
      try {
        return JSON.parse(text) as any;
      } catch {
        return null;
      }
    })();
    const correlationId =
      typeof parsed?.correlationId === 'string' && parsed.correlationId ? parsed.correlationId : '';
    const errMsg =
      typeof parsed?.error === 'string' && parsed.error ? parsed.error : '';

    // Treat overlap-policy skips as non-fatal so backfills can be re-run safely.
    // The API returns 409 with a human-readable "skipped" message.
    if (res.status === 409 && !args.overwrite) {
      return { skipped: true, status: 409, fileName: name, message: text };
    }
    throw new Error(
      [
        `Upload failed for "${name}" (${res.status}).`,
        correlationId ? `correlationId=${correlationId}` : '',
        errMsg ? `error=${errMsg}` : '',
        !parsed ? `body=${text}` : '',
      ].filter(Boolean).join(' '),
    );
  }

  try {
    return JSON.parse(text) as any;
  } catch {
    return { ok: true, raw: text };
  }
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Base URL: ${args.baseUrl}`);
  const cfg = loadIngestorOrThrow(args.id);

  if (!cfg.backfill?.enabled) throw new Error(`Backfill disabled for ingestor: ${args.id}`);
  if (cfg.backfill.kind !== 'directory') throw new Error(`Unsupported backfill kind: ${String(cfg.backfill?.kind)}`);
  if (!cfg.upload?.enabled) throw new Error(`This backfill runner requires upload.enabled=true for ingestor: ${args.id}`);

  const dirRel = cfg.backfill.dir || '';
  if (!dirRel) throw new Error('Missing backfill.dir in ingestor config');
  const dirAbs = path.isAbsolute(dirRel) ? dirRel : path.join(process.cwd(), dirRel);
  if (!fs.existsSync(dirAbs)) throw new Error(`Backfill dir does not exist: ${dirAbs}`);

  const pattern = cfg.backfill.pattern || '*';
  const files = listFiles(dirAbs, pattern);
  const names = files.map((f) => path.basename(f));

  if (names.length === 0) {
    console.log('No files matched; nothing to backfill.');
    return;
  }

  console.log(`Backfill: ${args.id}`);
  console.log(`Dir: ${dirAbs}`);
  console.log(`Pattern: ${pattern}`);
  console.log(`Files: ${names.length}`);

  const validate = cfg.backfill.validate_mappings !== false;
  if (validate) {
    console.log('Validating mappings…');
    await validateMappings(args, cfg, names);
    console.log('Mappings OK.');
  }

  if (args.validateOnly) {
    console.log('validate-only: done.');
    return;
  }

  const failures: Array<{ fileName: string; error: string }> = [];

  for (const filePath of files) {
    const name = path.basename(filePath);
    const size = fs.statSync(filePath).size;
    if (args.dryRun) {
      console.log(`[dry-run] would upload: ${name} (${size} bytes)`);
      continue;
    }
    console.log(`Uploading: ${name} (${size} bytes)…`);
    try {
      const result = await uploadOne(args, cfg.id, filePath);
      console.log(`Result: ${name} -> ${JSON.stringify(result)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e || 'Unknown error');
      failures.push({ fileName: name, error: msg });
      console.error(`Upload error: ${name}\n${msg}`);
      if (args.failFast) throw e;
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Backfill completed with ${failures.length} failure(s):\n` +
        failures.map((f) => `- ${f.fileName}: ${f.error.split('\n')[0]}`).join('\n'),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});


