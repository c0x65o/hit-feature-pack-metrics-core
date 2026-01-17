import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextResponse } from 'next/server';
import { getAuthContext } from '../lib/authz';
import { resolveMetricsCoreScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function appRoot() {
    return process.cwd();
}
function findIngestorsDir(startDir) {
    const checked = [];
    let cur = startDir;
    for (let i = 0; i < 10; i++) {
        // Check both .hit/metrics/ingestors (legacy) and schema/metrics/ingestors (new)
        const candidate = path.join(cur, '.hit', 'metrics', 'ingestors');
        checked.push(candidate);
        if (fs.existsSync(candidate))
            return { dir: candidate, checked };
        const candidateSchema = path.join(cur, 'schema', 'metrics', 'ingestors');
        checked.push(candidateSchema);
        if (fs.existsSync(candidateSchema))
            return { dir: candidateSchema, checked };
        const parent = path.dirname(cur);
        if (!parent || parent === cur)
            break;
        cur = parent;
    }
    return { dir: null, checked };
}
export async function GET(request) {
    const auth = getAuthContext(request);
    if (!auth || auth.kind !== 'user')
        return jsonError('Unauthorized', 401);
    // Resolve scope mode for read access
    const mode = await resolveMetricsCoreScopeMode(request, { verb: 'read', entity: 'providers' });
    // Apply scope-based filtering
    if (mode === 'none' || mode === 'own' || mode === 'ldd') {
        return jsonError('Unauthorized', 403);
    }
    else if (mode !== 'any') {
        return jsonError('Unauthorized', 403);
    }
    const { dir } = findIngestorsDir(appRoot());
    if (!dir)
        return NextResponse.json({ data: [] });
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    const ingestors = [];
    for (const f of files) {
        try {
            const raw = fs.readFileSync(path.join(dir, f), 'utf8');
            const cfg = yaml.load(raw) || null;
            if (cfg && cfg.id) {
                ingestors.push(cfg);
            }
        }
        catch {
            // Skip invalid YAML
        }
    }
    return NextResponse.json({ data: ingestors });
}
