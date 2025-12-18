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
function ingestorsDir() {
    return path.join(appRoot(), '.hit', 'metrics', 'ingestors');
}
function listIngestorFiles() {
    const dir = ingestorsDir();
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
        .map((e) => path.join(dir, e.name))
        .sort((a, b) => a.localeCompare(b));
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
    const out = [];
    for (const f of listIngestorFiles()) {
        const cfg = loadIngestorFile(f);
        if (cfg)
            out.push(cfg);
    }
    return NextResponse.json({ ingestors: out });
}
