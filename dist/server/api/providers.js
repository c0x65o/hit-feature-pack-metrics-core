import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions } from '../lib/partners';
import { metricsDataSources, metricsIngestBatches, metricsLinks, metricsMetricPoints, metricsPartnerCredentials } from '@/lib/feature-pack-schemas';
import { resolveMetricsCoreScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function toIsoDateOnly(input) {
    if (!input)
        return null;
    const d = input instanceof Date ? input : new Date(String(input));
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toISOString().slice(0, 10);
}
function toIsoDateTime(input) {
    if (!input)
        return null;
    const d = input instanceof Date ? input : new Date(String(input));
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toISOString();
}
function appRoot() {
    return process.cwd();
}
function findIngestorsDir(startDir) {
    const checked = [];
    let cur = startDir;
    for (let i = 0; i < 10; i++) {
        const candidate = path.join(cur, '.hit', 'metrics', 'ingestors');
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
function ingestorsDir() {
    const found = findIngestorsDir(appRoot());
    return found.dir;
}
function listIngestorFiles() {
    const dir = ingestorsDir();
    if (!dir)
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
function loadAllIngestors() {
    const out = [];
    for (const f of listIngestorFiles()) {
        const cfg = loadIngestorFile(f);
        if (cfg)
            out.push(cfg);
    }
    return out;
}
function loadHitYamlTasks() {
    const p = path.join(appRoot(), 'hit.yaml');
    if (!fs.existsSync(p))
        return {};
    const raw = fs.readFileSync(p, 'utf8');
    const doc = yaml.load(raw) || {};
    const tasks = doc.tasks || {};
    if (!tasks || typeof tasks !== 'object')
        return {};
    return tasks;
}
function resolveTask(name, tasks) {
    if (!name)
        return null;
    const t = tasks[name];
    const cmd = typeof t?.command === 'string' ? t.command : '';
    if (!cmd.trim())
        return null;
    return { name, command: cmd, description: t?.description || null };
}
function findBackfillTask(ingestorId, tasks) {
    const needle1 = `metrics-ingestor-backfill.js --id=${ingestorId}`;
    const needle2 = `metrics-ingestor-backfill.js --id ${ingestorId}`;
    for (const [name, cfg] of Object.entries(tasks)) {
        const cmd = cfg?.command || '';
        if (typeof cmd !== 'string')
            continue;
        if (cmd.includes(needle1) || cmd.includes(needle2)) {
            return { name, command: cmd, description: cfg?.description || null };
        }
    }
    return null;
}
function globToRegex(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(re);
}
function listBackfillFilenames(cfg, limit = 500) {
    const b = cfg.backfill;
    if (!b?.enabled || b.kind !== 'directory')
        return [];
    const dirRel = b.dir || '';
    if (!dirRel)
        return [];
    const dirAbs = path.isAbsolute(dirRel) ? dirRel : path.join(appRoot(), dirRel);
    if (!fs.existsSync(dirAbs))
        return [];
    const pat = b.pattern || '*';
    const re = globToRegex(pat);
    return fs
        .readdirSync(dirAbs, { withFileTypes: true })
        .filter((e) => e.isFile() && re.test(e.name))
        .map((e) => e.name)
        .slice(0, limit);
}
function requiredPartnerFields(partnerId) {
    const defs = loadPartnerDefinitions();
    const def = defs.find((d) => d.id === partnerId);
    if (!def)
        return null;
    const required = def.fields.filter((f) => !!f.required).map((f) => f.key);
    return { def, required };
}
function resolveIngestorTask(spec, fallbackName) {
    if (!spec)
        return null;
    if (typeof spec === 'string')
        return null; // legacy reference to hit.yaml task name
    if (typeof spec !== 'object')
        return null;
    const cmd = typeof spec.command === 'string' ? spec.command : '';
    if (!cmd.trim())
        return null;
    const name = typeof spec.name === 'string' && spec.name.trim() ? spec.name.trim() : fallbackName;
    const description = typeof spec.description === 'string' ? spec.description : null;
    const cron = typeof spec.cron === 'string' && spec.cron.trim() ? spec.cron.trim() : null;
    const service_name = typeof spec.service_name === 'string' && spec.service_name.trim() ? spec.service_name.trim() : null;
    return { name, command: cmd, description, cron, service_name };
}
async function computeProviderRow(cfg) {
    const db = getDb();
    const tasks = loadHitYamlTasks();
    const backfillTask = resolveIngestorTask(cfg.tasks?.backfill, `metrics-core-backfill-${cfg.id}`) ||
        resolveTask(typeof cfg.tasks?.backfill === 'string' ? cfg.tasks?.backfill : null, tasks) ||
        findBackfillTask(cfg.id, tasks);
    const syncTask = resolveIngestorTask(cfg.tasks?.sync, `metrics-core-sync-${cfg.id}`) ||
        resolveTask(typeof cfg.tasks?.sync === 'string' ? cfg.tasks?.sync : null, tasks);
    // preflight: mappings
    const mapping = cfg.upload?.mapping;
    const fileNames = listBackfillFilenames(cfg);
    let mappingOk = null;
    let mappingMissingCount = null;
    let mappingLinkType = null;
    if (cfg.backfill?.enabled && cfg.backfill.kind === 'directory' && mapping?.kind === 'metrics_links') {
        const validate = cfg.backfill.validate_mappings !== false;
        mappingLinkType = mapping.link_type || null;
        const mappingKey = mapping.key || 'exact_filename';
        if (validate && mappingLinkType && mappingKey === 'exact_filename' && fileNames.length > 0) {
            const existing = await db
                .select({ linkId: metricsLinks.linkId })
                .from(metricsLinks)
                .where(and(eq(metricsLinks.linkType, mappingLinkType), inArray(metricsLinks.linkId, fileNames)))
                .limit(1000);
            const have = new Set(existing.map((r) => r.linkId));
            const missing = fileNames.filter((n) => !have.has(n));
            mappingMissingCount = missing.length;
            mappingOk = missing.length === 0;
        }
        else if (validate && mappingLinkType && mappingKey === 'exact_filename') {
            mappingOk = true;
            mappingMissingCount = 0;
        }
        else if (validate && mappingLinkType && mappingKey === 'normalize_steam_sales') {
            // For Steam Sales, mapping can be derived from CSV contents (ProductID), so filename mapping is optional.
            mappingOk = true;
            mappingMissingCount = 0;
        }
    }
    // preflight: integration creds
    let integrationPartnerId = cfg.integration?.partner_id || null;
    let integrationRequired = cfg.integration?.required === false ? false : !!integrationPartnerId;
    let integrationOk = null;
    let integrationMissingFields = null;
    if (integrationPartnerId) {
        const req = requiredPartnerFields(integrationPartnerId);
        const rows = await db.select().from(metricsPartnerCredentials).where(eq(metricsPartnerCredentials.id, integrationPartnerId)).limit(1);
        const cred = rows[0] ?? null;
        if (!cred || !cred.enabled) {
            integrationOk = !integrationRequired ? true : false;
            integrationMissingFields = req?.required || [];
        }
        else if (!req) {
            integrationOk = true;
            integrationMissingFields = [];
        }
        else {
            const missing = req.required.filter((k) => {
                const v = cred.credentials?.[k];
                return v === null || v === undefined || (typeof v === 'string' && !v.trim());
            });
            integrationMissingFields = missing;
            integrationOk = missing.length === 0;
        }
    }
    // ingest stats (by data source + metric keys)
    const dataSourceId = cfg.data_source?.id || null;
    const connectorKey = cfg.data_source?.connector_key || null;
    let pointsCount = null;
    let firstPointDate = null;
    let lastPointDate = null;
    let lastUpdatedAt = null;
    let dataSourcesCount = null;
    if (dataSourceId && Array.isArray(cfg.metrics) && cfg.metrics.length > 0) {
        const rows = await db
            .select({
            c: sql `count(*)`.as('c'),
            minDate: sql `min(${metricsMetricPoints.date})`.as('min_date'),
            maxDate: sql `max(${metricsMetricPoints.date})`.as('max_date'),
            maxUpdated: sql `max(${metricsMetricPoints.updatedAt})`.as('max_updated'),
        })
            .from(metricsMetricPoints)
            .where(and(eq(metricsMetricPoints.dataSourceId, dataSourceId), inArray(metricsMetricPoints.metricKey, cfg.metrics)));
        const r = rows[0];
        pointsCount = Number(r?.c || 0);
        firstPointDate = toIsoDateOnly(r?.minDate);
        lastPointDate = toIsoDateOnly(r?.maxDate);
        lastUpdatedAt = toIsoDateTime(r?.maxUpdated);
        dataSourcesCount = 1;
    }
    else if (connectorKey && Array.isArray(cfg.metrics) && cfg.metrics.length > 0) {
        // Aggregate across all data sources for this connector.
        const rows = await db
            .select({
            dsCount: sql `count(distinct ${metricsDataSources.id})`.as('ds_count'),
            pCount: sql `count(${metricsMetricPoints.id})`.as('p_count'),
            minDate: sql `min(${metricsMetricPoints.date})`.as('min_date'),
            maxDate: sql `max(${metricsMetricPoints.date})`.as('max_date'),
            maxUpdated: sql `max(${metricsMetricPoints.updatedAt})`.as('max_updated'),
        })
            .from(metricsMetricPoints)
            .innerJoin(metricsDataSources, eq(metricsMetricPoints.dataSourceId, metricsDataSources.id))
            .where(and(eq(metricsDataSources.connectorKey, connectorKey), inArray(metricsMetricPoints.metricKey, cfg.metrics)));
        const r = rows[0];
        dataSourcesCount = Number(r?.dsCount || 0);
        pointsCount = Number(r?.pCount || 0);
        firstPointDate = toIsoDateOnly(r?.minDate);
        lastPointDate = toIsoDateOnly(r?.maxDate);
        lastUpdatedAt = toIsoDateTime(r?.maxUpdated);
    }
    // last batch
    let lastBatchAt = null;
    let lastBatchFile = null;
    if (dataSourceId) {
        const b = await db
            .select({
            processedAt: metricsIngestBatches.processedAt,
            fileName: metricsIngestBatches.fileName,
            status: metricsIngestBatches.status,
        })
            .from(metricsIngestBatches)
            .where(eq(metricsIngestBatches.dataSourceId, dataSourceId))
            .orderBy(sql `${metricsIngestBatches.processedAt} DESC NULLS LAST`)
            .limit(1);
        if (b[0]?.processedAt)
            lastBatchAt = toIsoDateTime(b[0].processedAt);
        if (b[0]?.fileName)
            lastBatchFile = String(b[0].fileName);
    }
    return {
        id: cfg.id,
        label: cfg.label || cfg.id,
        description: cfg.description || null,
        metricsCount: Array.isArray(cfg.metrics) ? cfg.metrics.length : 0,
        uploadEnabled: !!cfg.upload?.enabled,
        backfillEnabled: !!cfg.backfill?.enabled,
        dataSourceId,
        dataSourceConnectorKey: connectorKey,
        scope: cfg.scope || null,
        backfillTaskName: backfillTask?.name || null,
        backfillTaskCommand: backfillTask?.command || null,
        syncTaskName: syncTask?.name || null,
        syncTaskCommand: syncTask?.command || null,
        backfillFilesCount: fileNames.length,
        mapping: mapping?.kind === 'metrics_links' ? { kind: 'metrics_links', linkType: mappingLinkType, key: mapping.key || 'exact_filename' } : null,
        preflight: {
            mappingOk,
            mappingMissingCount,
            integrationPartnerId,
            integrationRequired,
            integrationOk,
            integrationMissingFields,
        },
        stats: {
            dataSourcesCount,
            pointsCount,
            firstPointDate,
            lastPointDate,
            lastUpdatedAt,
            lastBatchAt,
            lastBatchFile,
        },
    };
}
export async function GET(request) {
    const auth = getAuthContext(request);
    if (!auth || auth.kind !== 'user')
        return jsonError('Unauthorized', 401);
    // Resolve scope mode for read access
    const mode = await resolveMetricsCoreScopeMode(request, { verb: 'read', entity: 'providers' });
    // Apply scope-based filtering (explicit branching on none/own/ldd/any)
    if (mode === 'none') {
        // Explicit deny: return empty results (fail-closed but non-breaking for list UI)
        return NextResponse.json({ data: [] });
    }
    else if (mode === 'own' || mode === 'ldd') {
        // Metrics-core doesn't have ownership or LDD fields, so deny access
        return NextResponse.json({ data: [] });
    }
    else if (mode !== 'any') {
        // Fallback: deny access
        return NextResponse.json({ data: [] });
    }
    const ingestors = loadAllIngestors();
    const rows = await Promise.all(ingestors.map((cfg) => computeProviderRow(cfg)));
    rows.sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json({ data: rows });
}
