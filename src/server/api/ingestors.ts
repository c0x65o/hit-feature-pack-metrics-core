import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type IngestorConfig = {
  id: string;
  label?: string;
  description?: string;
  metrics?: string[];
  data_source?: { id: string; connector_key?: string; source_kind?: string; external_ref?: string | null };
  scope?: { entity_kind: string; entity_id: string };
  upload?: { enabled?: boolean };
  backfill?: { enabled?: boolean };
};

function appRoot() {
  return process.cwd();
}

function findHitDir(startDir: string): { dir: string | null; checked: string[] } {
  const checked: string[] = [];
  let cur = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(cur, '.hit', 'metrics', 'ingestors');
    checked.push(candidate);
    if (fs.existsSync(candidate)) return { dir: candidate, checked };
    const parent = path.dirname(cur);
    if (!parent || parent === cur) break;
    cur = parent;
  }
  return { dir: null, checked };
}

function ingestorsDir() {
  const found = findHitDir(appRoot());
  return found.dir;
}

function listIngestorFiles(): string[] {
  const dir = ingestorsDir();
  if (!dir) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => a.localeCompare(b));
}

function loadIngestorFile(filePath: string): IngestorConfig | null {
  const raw = fs.readFileSync(filePath, 'utf8');
  const cfg = (yaml.load(raw) as IngestorConfig) || null;
  if (!cfg || !cfg.id) return null;
  return cfg;
}

export async function GET(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return jsonError('Unauthorized', 401);

  const out: IngestorConfig[] = [];
  for (const f of listIngestorFiles()) {
    const cfg = loadIngestorFile(f);
    if (cfg) out.push(cfg);
  }

  return NextResponse.json({ ingestors: out });
}


