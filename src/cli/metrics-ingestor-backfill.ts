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
 *   using X-HIT-Service-Token
 *
 * This keeps metrics-core dumb about CSV formats while still providing the
 * "heavy lifting" orchestration: discovery, validation, and execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

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
  serviceToken: string;
  dryRun: boolean;
  validateOnly: boolean;
  overwrite: boolean;
};

function parseArgs(argv: string[]): Args {
  const baseUrl = process.env.HIT_APP_URL || 'http://localhost:3000';
  const serviceToken = process.env.HIT_SERVICE_TOKEN || '';

  const out: Args = {
    id: '',
    baseUrl,
    serviceToken,
    dryRun: false,
    validateOnly: false,
    overwrite: false,
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
    else if (a === '--service-token') out.serviceToken = next();
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--validate-only') out.validateOnly = true;
    else if (a === '--overwrite') out.overwrite = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  if (!out.id.trim()) throw new Error('Missing --id <ingestorId>');
  if (!out.serviceToken) throw new Error('Missing service token. Set HIT_SERVICE_TOKEN or pass --service-token');
  return out;
}

function stripTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function ingestorYamlPath(ingestorId: string) {
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

async function validateMappings(args: Args, cfg: IngestorYaml, fileNames: string[]) {
  const mapping = cfg.upload?.mapping;
  if (!mapping || mapping.kind !== 'metrics_links') return;
  const linkType = mapping.link_type;
  if (!linkType) return;

  // For now, only enforce mapping validation for exact_filename (or omitted).
  const mappingKey = mapping.key || 'exact_filename';
  if (mappingKey !== 'exact_filename') return;

  const missing: string[] = [];
  for (const name of fileNames) {
    const url = `${stripTrailingSlash(args.baseUrl)}/api/metrics/links?linkType=${encodeURIComponent(linkType)}&q=${encodeURIComponent(name)}&limit=500`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-HIT-Service-Token': args.serviceToken },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Mapping validation failed (${res.status}): ${body}`);
    }
    const json = (await res.json().catch(() => null)) as any;
    const rows = Array.isArray(json?.data) ? (json.data as Array<{ linkId?: string }>) : [];
    const exact = rows.some((r) => r?.linkId === name);
    if (!exact) missing.push(name);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required metrics_links mappings for ${missing.length} file(s).\n` +
        `Expected link_type="${linkType}" and link_id to match filenames exactly.\n` +
        missing.map((m) => `- ${m}`).join('\n'),
    );
  }
}

async function uploadOne(args: Args, ingestorId: string, filePath: string) {
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);

  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'text/csv' }), name);
  if (args.overwrite) form.append('overwrite', 'true');

  const res = await fetch(`${stripTrailingSlash(args.baseUrl)}/api/metrics/ingestors/${encodeURIComponent(ingestorId)}/upload`, {
    method: 'POST',
    headers: { 'X-HIT-Service-Token': args.serviceToken },
    body: form,
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    // Treat overlap-policy skips as non-fatal so backfills can be re-run safely.
    // The API returns 409 with a human-readable "skipped" message.
    if (res.status === 409 && !args.overwrite) {
      return { skipped: true, status: 409, fileName: name, message: text };
    }
    throw new Error(`Upload failed for "${name}" (${res.status}): ${text}`);
  }

  try {
    return JSON.parse(text) as any;
  } catch {
    return { ok: true, raw: text };
  }
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
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

  for (const filePath of files) {
    const name = path.basename(filePath);
    const size = fs.statSync(filePath).size;
    if (args.dryRun) {
      console.log(`[dry-run] would upload: ${name} (${size} bytes)`);
      continue;
    }
    console.log(`Uploading: ${name} (${size} bytes)…`);
    const result = await uploadOne(args, cfg.id, filePath);
    console.log(`Result: ${name} -> ${JSON.stringify(result)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});


