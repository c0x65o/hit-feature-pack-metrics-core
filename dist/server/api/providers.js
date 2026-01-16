import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions } from '../lib/partners';
import { metricsDataSources, metricsLinks, metricsMetricPoints, metricsPartnerCredentials, metricsIngestBatches } from '@/lib/feature-pack-schemas';
import { resolveMetricsCoreScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function appRoot() {
    return process.cwd();
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
function globToRegex(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(re);
}
function countBackfillFiles(cfg) {
    const b = cfg.backfill;
    if (!b?.enabled || b.kind !== 'directory')
        return 0;
    const dirRel = b.dir || '';
    if (!dirRel)
        return 0;
    const dirAbs = path.isAbsolute(dirRel) ? dirRel : path.join(appRoot(), dirRel);
    if (!fs.existsSync(dirAbs))
        return 0;
    const pat = b.pattern || '*';
    const re = globToRegex(pat);
    try {
        return fs.readdirSync(dirAbs).filter((name) => re.test(name)).length;
    }
    catch {
        return 0;
    }
}
function resolveIngestorTask(spec, fallbackName) {
    if (!spec)
        return null;
    if (typeof spec === 'string')
        return null; // legacy reference to hit.yaml
    if (typeof spec !== 'object' || Array.isArray(spec))
        return null;
    const rec = spec;
    const cmd = typeof rec.command === 'string' ? rec.command : '';
    if (!cmd.trim())
        return null;
    const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : fallbackName;
    const description = typeof rec.description === 'string' ? rec.description : null;
    const cron = typeof rec.cron === 'string' && rec.cron.trim() ? rec.cron.trim() : null;
    const service_name = typeof rec.service_name === 'string' && rec.service_name.trim() ? rec.service_name.trim() : null;
    return { name, command: cmd, description, cron, service_name };
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
    const providers = [];
    const db = getDb();
    const tasks = loadHitYamlTasks();
    const partnerDefs = loadPartnerDefinitions();
    // Load all partner credentials in one go
    const allCreds = await db.select().from(metricsPartnerCredentials);
    const credsById = new Map(allCreds.map((c) => [c.id, c]));
    for (const f of files) {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const cfg = yaml.load(raw) || null;
        if (!cfg || !cfg.id)
            continue;
        const backfillTask = resolveIngestorTask(cfg.tasks?.backfill, `metrics-core-backfill-${cfg.id}`) ||
            resolveTask(typeof cfg.tasks?.backfill === 'string' ? cfg.tasks?.backfill : null, tasks) ||
            findBackfillTask(cfg.id, tasks);
        const syncTask = resolveIngestorTask(cfg.tasks?.sync, `metrics-core-sync-${cfg.id}`) ||
            resolveTask(typeof cfg.tasks?.sync === 'string' ? cfg.tasks?.sync : null, tasks);
        const backfillFilesCount = countBackfillFiles(cfg);
        // Preflight check: mappings
        const mapping = cfg.upload?.mapping;
        const mappingLinkType = mapping?.kind === 'metrics_links' ? mapping.link_type || null : null;
        let mappingOk = null;
        let mappingMissingCount = null;
        if (cfg.backfill?.enabled && cfg.backfill.kind === 'directory' && mapping?.kind === 'metrics_links') {
            const validate = cfg.backfill.validate_mappings !== false;
            const linkType = mapping.link_type || '';
            const key = mapping.key || 'exact_filename';
            if (validate && linkType && key === 'exact_filename') {
                const fileNames = fs.readdirSync(path.join(appRoot(), cfg.backfill.dir || '')).filter((n) => globToRegex(cfg.backfill?.pattern || '*').test(n));
                if (fileNames.length > 0) {
                    const existing = await db
                        .select({ linkId: metricsLinks.linkId })
                        .from(metricsLinks)
                        .where(and(eq(metricsLinks.linkType, linkType), inArray(metricsLinks.linkId, fileNames)))
                        .limit(5000);
                    const have = new Set(existing.map((r) => r.linkId));
                    const missing = fileNames.filter((n) => !have.has(n));
                    mappingOk = missing.length === 0;
                    mappingMissingCount = missing.length;
                }
                else {
                    mappingOk = true;
                    mappingMissingCount = 0;
                }
            }
            else if (validate && linkType && key === 'normalize_steam_sales') {
                mappingOk = true;
                mappingMissingCount = 0;
            }
        }
        // Preflight check: integration
        const partnerId = cfg.integration?.partner_id || null;
        const partnerDef = partnerId ? partnerDefs.find((d) => d.id === partnerId) || null : null;
        const cred = partnerId ? credsById.get(partnerId) : null;
        const requiredFields = partnerDef ? partnerDef.fields.filter((field) => !!field.required).map((field) => field.key) : [];
        const missingFields = cred
            ? requiredFields.filter((k) => {
                const v = cred.credentials?.[k];
                return v === null || v === undefined || (typeof v === 'string' && !v.trim());
            })
            : requiredFields;
        const integrationOk = partnerId ? !!cred && (cred.enabled ?? false) && missingFields.length === 0 : null;
        // Stats
        const dataSourceId = cfg.data_source?.id || null;
        const connectorKey = cfg.data_source?.connector_key || null;
        let stats = {
            dataSourcesCount: null,
            pointsCount: null,
            firstPointDate: null,
            lastPointDate: null,
            lastUpdatedAt: null,
            lastBatchAt: null,
            lastBatchFile: null,
        };
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
            const lastBatchRows = await db
                .select({
                processedAt: metricsIngestBatches.processedAt,
                fileName: metricsIngestBatches.fileName,
            })
                .from(metricsIngestBatches)
                .where(eq(metricsIngestBatches.dataSourceId, dataSourceId))
                .orderBy(sql `${metricsIngestBatches.processedAt} DESC`)
                .limit(1);
            const r = rows[0];
            const lb = lastBatchRows[0];
            stats = {
                pointsCount: Number(r?.c || 0),
                firstPointDate: r?.minDate ? new Date(r.minDate).toISOString() : null,
                lastPointDate: r?.maxDate ? new Date(r.maxDate).toISOString() : null,
                lastUpdatedAt: r?.maxUpdated ? new Date(r.maxUpdated).toISOString() : null,
                dataSourcesCount: 1,
                lastBatchAt: lb?.processedAt ? new Date(lb.processedAt).toISOString() : null,
                lastBatchFile: lb?.fileName || null,
            };
        }
        else if (connectorKey && Array.isArray(cfg.metrics) && cfg.metrics.length > 0) {
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
            stats = {
                pointsCount: Number(r?.pCount || 0),
                firstPointDate: r?.minDate ? new Date(r.minDate).toISOString() : null,
                lastPointDate: r?.maxDate ? new Date(r.maxDate).toISOString() : null,
                lastUpdatedAt: r?.maxUpdated ? new Date(r.maxUpdated).toISOString() : null,
                dataSourcesCount: Number(r?.dsCount || 0),
                lastBatchAt: null,
                lastBatchFile: null,
            };
        }
        providers.push({
            id: cfg.id,
            label: cfg.label || cfg.id,
            description: cfg.description || null,
            metricsCount: cfg.metrics?.length || 0,
            uploadEnabled: !!cfg.upload?.enabled,
            backfillEnabled: !!cfg.backfill?.enabled,
            dataSourceId: cfg.data_source?.id || null,
            backfillTaskName: backfillTask?.name || null,
            backfillTaskCommand: backfillTask?.command || null,
            syncTaskName: syncTask?.name || null,
            syncTaskCommand: syncTask?.command || null,
            backfillFilesCount,
            preflight: {
                mappingOk,
                mappingMissingCount,
                integrationPartnerId: partnerId,
                integrationRequired: !!cfg.integration?.required,
                integrationOk,
                integrationMissingFields: missingFields.length > 0 ? missingFields : null,
            },
            stats,
        });
    }
    return NextResponse.json({ data: providers });
}
