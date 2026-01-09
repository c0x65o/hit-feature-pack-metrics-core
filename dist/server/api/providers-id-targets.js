import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formEntries, projects } from '@/lib/feature-pack-schemas';
import { eq, inArray } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function appRoot() {
    return process.cwd();
}
function ingestorYamlPath(id) {
    let cur = appRoot();
    for (let i = 0; i < 10; i++) {
        const candidate = path.join(cur, '.hit', 'metrics', 'ingestors', `${id}.yaml`);
        if (fs.existsSync(candidate))
            return candidate;
        const candidate2 = path.join(cur, '.hit', 'metrics', 'ingestors', `${id}.yml`);
        if (fs.existsSync(candidate2))
            return candidate2;
        const parent = path.dirname(cur);
        if (!parent || parent === cur)
            break;
        cur = parent;
    }
    // Default (will 404 later) — keep error behavior stable.
    return path.join(appRoot(), '.hit', 'metrics', 'ingestors', `${id}.yaml`);
}
function getPath(obj, pathStr) {
    const parts = pathStr.split('.').filter(Boolean);
    let cur = obj;
    for (const p of parts) {
        if (cur === null || cur === undefined)
            return undefined;
        cur = cur[p];
    }
    return cur;
}
function toUsername(raw) {
    const u = raw.trim().replace(/^@/, '');
    if (!u)
        return null;
    return u;
}
function extractTikTokUsernameFromForm(handle, url) {
    const h = typeof handle === 'string' ? handle : '';
    const u = typeof url === 'string' ? url : '';
    const fromHandle = toUsername(h);
    if (fromHandle)
        return fromHandle;
    if (u) {
        const m = u.match(/tiktok\.com\/@([^\/\?]+)/i);
        if (m?.[1])
            return toUsername(m[1]);
    }
    return null;
}
function passesWhere(row, where) {
    if (!where || where.length === 0)
        return true;
    for (const w of where) {
        const v = getPath(row, w.path);
        if (w.op === 'exists') {
            if (v === undefined || v === null)
                return false;
            continue;
        }
        if (w.op === 'eq') {
            if (v !== w.value)
                return false;
            continue;
        }
        if (w.op === 'neq') {
            if (v === w.value)
                return false;
            continue;
        }
    }
    return true;
}
export async function GET(request, ctx) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const id = ctx.params.id;
    const url = new URL(request.url);
    const qsLimit = url.searchParams.get('limit');
    const qsScanLimit = url.searchParams.get('scanLimit');
    const countOnly = url.searchParams.get('count_only') === '1' ||
        url.searchParams.get('countOnly') === '1' ||
        url.searchParams.get('count_only') === 'true' ||
        url.searchParams.get('countOnly') === 'true';
    const p = ingestorYamlPath(id);
    if (!fs.existsSync(p))
        return jsonError(`Unknown provider/ingestor: ${id}`, 404);
    const raw = fs.readFileSync(p, 'utf8');
    const cfg = yaml.load(raw) || null;
    if (!cfg || !cfg.id)
        return jsonError(`Invalid ingestor config: ${p}`, 500);
    const spec = cfg.targets_preview || null;
    if (!spec)
        return NextResponse.json({
            columns: [],
            rows: [],
            meta: { id, kind: null, formId: null, limit: 0, scanLimit: 0, scanned: 0, filtered: 0, returned: 0, truncatedScan: false },
        });
    if (spec.kind !== 'forms')
        return jsonError(`Unsupported targets_preview.kind: ${spec.kind}`, 400);
    const configuredLimit = Number(spec.limit || 200);
    const requestedLimit = qsLimit ? Number(qsLimit) : configuredLimit;
    const requestedScanLimit = qsScanLimit ? Number(qsScanLimit) : Math.max(configuredLimit, requestedLimit);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1), 1000);
    const scanLimit = Math.min(Math.max(Number.isFinite(requestedScanLimit) ? requestedScanLimit : 200, limit), 5000);
    const formId = typeof spec.form_id === 'string' ? spec.form_id.trim() : '';
    if (!formId)
        return jsonError('targets_preview.form_id is required', 400);
    const db = getDb();
    const entries = await db
        .select({ id: formEntries.id, data: formEntries.data, createdAt: formEntries.createdAt })
        .from(formEntries)
        .where(eq(formEntries.formId, formId))
        .limit(scanLimit);
    const rowsBase = entries
        .map((e) => ({ id: String(e.id), data: (e.data || {}), createdAt: e.createdAt || null }))
        .filter((r) => passesWhere(r, spec.where || []));
    const truncatedScan = entries.length >= scanLimit;
    const filtered = rowsBase.length;
    if (countOnly) {
        return NextResponse.json({
            columns: [],
            rows: [],
            meta: { id, kind: spec.kind, formId, limit, scanLimit, scanned: entries.length, filtered, returned: 0, truncatedScan },
        });
    }
    // Optional project enrichment (only if any column references projectId)
    const needsProject = spec.columns.some((c) => c && typeof c === 'object' && 'path' in c && typeof c.path === 'string' && c.path.includes('data.project.entityId')) || spec.columns.some((c) => c && typeof c === 'object' && String(c.key) === 'projectSlug');
    let projectSlugById = new Map();
    if (needsProject) {
        const projectIds = Array.from(new Set(rowsBase
            .map((r) => {
            const proj = r.data?.project;
            return proj && typeof proj === 'object' && typeof proj.entityId === 'string' ? proj.entityId : null;
        })
            .filter(Boolean)));
        if (projectIds.length > 0) {
            const ps = await db
                .select({ id: projects.id, slug: projects.slug })
                .from(projects)
                .where(inArray(projects.id, projectIds));
            projectSlugById = new Map(ps.map((r) => [String(r.id), String(r.slug || '')]));
        }
    }
    const columns = spec.columns.map((c) => ({
        key: String(c.key),
        label: typeof c.label === 'string' && c.label.trim() ? c.label.trim() : String(c.key),
    }));
    const outRows = rowsBase.slice(0, limit).map((r) => {
        const rec = {};
        for (const col of spec.columns) {
            if (col.path) {
                const v = getPath(r, String(col.path));
                const key = String(col.key);
                if (key === 'projectSlug') {
                    const projectId = typeof v === 'string' ? v : '';
                    rec[key] = projectId ? projectSlugById.get(projectId) || null : null;
                }
                else {
                    rec[key] = v === undefined ? null : v;
                }
                continue;
            }
            if (col.computed === 'tiktok_username') {
                rec[String(col.key)] = extractTikTokUsernameFromForm(r.data?.account_handle, r.data?.account_url);
                continue;
            }
        }
        // helpful enrichment without requiring explicit columns
        const proj = r.data?.project;
        const projectId = proj && typeof proj === 'object' && typeof proj.entityId === 'string' ? proj.entityId : null;
        if (projectId && !('projectSlug' in rec))
            rec.projectSlug = projectSlugById.get(projectId) || null;
        return rec;
    });
    return NextResponse.json({
        columns,
        rows: outRows,
        meta: { id, kind: spec.kind, formId, limit, scanLimit, scanned: entries.length, filtered, returned: outRows.length, truncatedScan },
    });
}
