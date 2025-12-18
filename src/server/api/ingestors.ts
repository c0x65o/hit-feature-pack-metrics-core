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

function ingestorsDir() {
  return path.join(appRoot(), '.hit', 'metrics', 'ingestors');
}

function listIngestorFiles(): string[] {
  const dir = ingestorsDir();
  if (!fs.existsSync(dir)) return [];
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


