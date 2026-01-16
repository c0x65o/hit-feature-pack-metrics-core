import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '../lib/authz';
import { resolveMetricsCoreScopeMode } from '../lib/scope-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function appRoot() {
  return process.cwd();
}

function findIngestorsDir(startDir: string): { dir: string | null; checked: string[] } {
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

export async function GET(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth || auth.kind !== 'user') return jsonError('Unauthorized', 401);

  // Resolve scope mode for read access
  const mode = await resolveMetricsCoreScopeMode(request, { verb: 'read', entity: 'providers' });

  // Apply scope-based filtering
  if (mode === 'none' || mode === 'own' || mode === 'ldd') {
    return jsonError('Unauthorized', 403);
  } else if (mode !== 'any') {
    return jsonError('Unauthorized', 403);
  }

  const { dir } = findIngestorsDir(appRoot());
  if (!dir) return NextResponse.json({ data: [] });

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const ingestors: any[] = [];

  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const cfg = (yaml.load(raw) as any) || null;
      if (cfg && cfg.id) {
        ingestors.push(cfg);
      }
    } catch {
      // Skip invalid YAML
    }
  }

  return NextResponse.json({ data: ingestors });
}
