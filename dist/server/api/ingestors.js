import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextResponse } from 'next/server';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function appRoot() {
    return process.cwd();
}
function findDirUp(startDir, rel) {
    const checked = [];
    let cur = startDir;
    for (let i = 0; i < 10; i++) {
        const candidate = path.join(cur, rel);
        checked.push(candidate);
        if (fs.existsSync(candidate))
            return { dir: candidate, checked };
        const parent = path.dirname(cur);
        if (!parent || parent === cur)
            break;
        cur = parent;
    }
    return { dir: null, checked };
}
function ingestorsDirs() {
    // Preferred schema-driven location:
    //   schema/metrics/ingestors/*.yaml
    // Legacy fallback:
    //   .hit/metrics/ingestors/*.yaml
    const schemaFound = findDirUp(appRoot(), path.join('schema', 'metrics', 'ingestors'));
    const hitFound = findDirUp(appRoot(), path.join('.hit', 'metrics', 'ingestors'));
    const out = [schemaFound.dir, hitFound.dir].filter(Boolean);
    // De-dupe if they happen to be the same path
    return Array.from(new Set(out));
}
function listIngestorFiles() {
    const dirs = ingestorsDirs();
    if (!dirs.length)
        return [];
    const out = [];
    for (const dir of dirs) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!e.isFile())
                continue;
            if (!e.name.endsWith('.yaml') && !e.name.endsWith('.yml'))
                continue;
            out.push(path.join(dir, e.name));
        }
    }
    return out.sort((a, b) => a.localeCompare(b));
}
function loadIngestorFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const cfg = yaml.load(raw) || null;
    if (!cfg || !cfg.id)
        return null;
    return cfg;
}
export async function GET(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    // Merge by id; schema wins over legacy on collisions.
    const byId = new Map();
    for (const f of listIngestorFiles()) {
        const cfg = loadIngestorFile(f);
        if (!cfg)
            continue;
        byId.set(cfg.id, cfg);
    }
    const ingestors = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    return NextResponse.json({ ingestors });
}
