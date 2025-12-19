import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions } from '../lib/partners';
import { metricsDataSources, metricsLinks, metricsMetricPoints, metricsPartnerCredentials } from '@/lib/feature-pack-schemas';
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
function ingestorYamlPath(id) {
    return path.join(appRoot(), '.hit', 'metrics', 'ingestors', `${id}.yaml`);
}
function globToRegex(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(re);
}
function listBackfillFilenames(cfg, limit = 2000) {
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
    return { name, command: cmd, description, cron };
}
export async function GET(request, ctx) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const id = ctx.params.id;
    const p = ingestorYamlPath(id);
    if (!fs.existsSync(p))
        return jsonError(`Unknown provider/ingestor: ${id}`, 404);
    const raw = fs.readFileSync(p, 'utf8');
    const cfg = yaml.load(raw) || null;
    if (!cfg || !cfg.id)
        return jsonError(`Invalid ingestor config: ${p}`, 500);
    const db = getDb();
    const tasks = loadHitYamlTasks();
    const backfillTask = resolveIngestorTask(cfg.tasks?.backfill, `metrics-core-backfill-${cfg.id}`) ||
        resolveTask(typeof cfg.tasks?.backfill === 'string' ? cfg.tasks?.backfill : null, tasks) ||
        findBackfillTask(cfg.id, tasks);
    const syncTask = resolveIngestorTask(cfg.tasks?.sync, `metrics-core-sync-${cfg.id}`) ||
        resolveTask(typeof cfg.tasks?.sync === 'string' ? cfg.tasks?.sync : null, tasks);
    const fileNames = listBackfillFilenames(cfg);
    const mapping = cfg.upload?.mapping;
    let mappingMissing = [];
    const mappingLinkType = mapping?.kind === 'metrics_links' ? mapping.link_type || null : null;
    const mappingKey = mapping?.kind === 'metrics_links' ? mapping.key || 'exact_filename' : null;
    let linkedProjects = [];
    if (cfg.backfill?.enabled && cfg.backfill.kind === 'directory' && mapping?.kind === 'metrics_links') {
        const validate = cfg.backfill.validate_mappings !== false;
        const linkType = mapping.link_type || '';
        const key = mapping.key || 'exact_filename';
        if (validate && linkType && key === 'exact_filename' && fileNames.length > 0) {
            const existing = await db
                .select({ linkId: metricsLinks.linkId, metadata: metricsLinks.metadata })
                .from(metricsLinks)
                .where(and(eq(metricsLinks.linkType, linkType), inArray(metricsLinks.linkId, fileNames)))
                .limit(5000);
            const have = new Set(existing.map((r) => r.linkId));
            mappingMissing = fileNames.filter((n) => !have.has(n));
            // Linkage summary:
            // filename (metrics.field_mapper) -> steam_app_id (metadata) -> project (steam.app target)
            const fileToSteamAppId = new Map();
            for (const r of existing) {
                const meta = (r?.metadata || {});
                const sid = typeof meta?.steam_app_id === 'string' ? meta.steam_app_id : String(meta?.steam_app_id || '');
                if (sid.trim())
                    fileToSteamAppId.set(String(r.linkId), sid.trim());
            }
            const steamAppIds = Array.from(new Set(Array.from(fileToSteamAppId.values())));
            if (steamAppIds.length > 0) {
                const steamRows = await db
                    .select({ linkId: metricsLinks.linkId, targetId: metricsLinks.targetId, metadata: metricsLinks.metadata })
                    .from(metricsLinks)
                    .where(and(eq(metricsLinks.linkType, 'steam.app'), inArray(metricsLinks.linkId, steamAppIds), eq(metricsLinks.targetKind, 'project')))
                    .limit(5000);
                const appToProject = new Map();
                for (const r of steamRows) {
                    const pid = typeof r?.targetId === 'string' ? r.targetId : '';
                    if (!pid.trim())
                        continue;
                    const meta = (r?.metadata || {});
                    const projectSlug = typeof meta?.project_slug === 'string' ? meta.project_slug : null;
                    const group = typeof meta?.type === 'string' ? meta.type : typeof meta?.source === 'string' ? meta.source : null;
                    appToProject.set(String(r.linkId), { projectId: pid.trim(), projectSlug, group });
                }
                const byProject = new Map();
                for (const [fn, sid] of fileToSteamAppId.entries()) {
                    const proj = appToProject.get(sid);
                    if (!proj)
                        continue;
                    const key = proj.projectId;
                    const cur = byProject.get(key) || { projectId: proj.projectId, projectSlug: proj.projectSlug, steamAppIds: [], fileNames: [] };
                    cur.fileNames.push(fn);
                    if (!cur.steamAppIds.some((x) => x.steamAppId === sid))
                        cur.steamAppIds.push({ steamAppId: sid, group: proj.group });
                    byProject.set(key, cur);
                }
                linkedProjects = Array.from(byProject.values()).sort((a, b) => (a.projectSlug || a.projectId).localeCompare(b.projectSlug || b.projectId));
            }
        }
        // Steam Sales can infer app_id from CSV contents; don't block on filename mappings.
        if (validate && linkType && key === 'normalize_steam_sales') {
            mappingMissing = [];
        }
    }
    // Aggregate revenue totals per linked project (fast sanity check for "project-level rollups").
    // Note: today we ingest Steam CSVs as:
    // - gross_revenue_usd (Steam-specific)
    // - revenue_usd       (net)
    // We also accept revenue_gross_usd if/when we standardize on the canonical key.
    if (linkedProjects.length > 0) {
        const projectIds = linkedProjects.map((p) => p.projectId).filter(Boolean);
        if (projectIds.length > 0) {
            const rows = await db
                .select({
                entityId: metricsMetricPoints.entityId,
                gross: sql `COALESCE(SUM(CASE WHEN ${metricsMetricPoints.metricKey} IN ('gross_revenue_usd','revenue_gross_usd') THEN CAST(${metricsMetricPoints.value} AS NUMERIC) ELSE 0 END), 0)`.as('gross'),
                net: sql `COALESCE(SUM(CASE WHEN ${metricsMetricPoints.metricKey} = 'revenue_usd' THEN CAST(${metricsMetricPoints.value} AS NUMERIC) ELSE 0 END), 0)`.as('net'),
            })
                .from(metricsMetricPoints)
                .where(and(eq(metricsMetricPoints.entityKind, 'project'), inArray(metricsMetricPoints.entityId, projectIds), inArray(metricsMetricPoints.metricKey, ['gross_revenue_usd', 'revenue_gross_usd', 'revenue_usd'])))
                .groupBy(metricsMetricPoints.entityId);
            const byProjectId = new Map();
            for (const r of rows) {
                const pid = String(r?.entityId || '');
                const gross = Number(r?.gross ?? 0);
                const net = Number(r?.net ?? 0);
                if (pid)
                    byProjectId.set(pid, { grossRevenueUsd: Number.isFinite(gross) ? gross : 0, netRevenueUsd: Number.isFinite(net) ? net : 0 });
            }
            linkedProjects = linkedProjects.map((p) => ({
                ...p,
                totals: byProjectId.get(p.projectId) || { grossRevenueUsd: 0, netRevenueUsd: 0 },
            }));
        }
    }
    // integration details
    const partnerId = cfg.integration?.partner_id || null;
    const defs = loadPartnerDefinitions();
    const partnerDef = partnerId ? defs.find((d) => d.id === partnerId) || null : null;
    const requiredFields = partnerDef ? partnerDef.fields.filter((f) => !!f.required).map((f) => f.key) : [];
    const credRows = partnerId
        ? await db.select().from(metricsPartnerCredentials).where(eq(metricsPartnerCredentials.id, partnerId)).limit(1)
        : [];
    const cred = credRows[0] ?? null;
    const missingFields = cred
        ? requiredFields.filter((k) => {
            const v = cred.credentials?.[k];
            return v === null || v === undefined || (typeof v === 'string' && !v.trim());
        })
        : requiredFields;
    // stats
    const dataSourceId = cfg.data_source?.id || null;
    const connectorKey = cfg.data_source?.connector_key || null;
    let stats = null;
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
        stats = {
            pointsCount: Number(r?.c || 0),
            firstPointDate: r?.minDate ? r.minDate.toISOString().slice(0, 10) : null,
            lastPointDate: r?.maxDate ? r.maxDate.toISOString().slice(0, 10) : null,
            lastUpdatedAt: r?.maxUpdated ? r.maxUpdated.toISOString() : null,
            dataSourcesCount: 1,
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
            firstPointDate: r?.minDate ? r.minDate.toISOString().slice(0, 10) : null,
            lastPointDate: r?.maxDate ? r.maxDate.toISOString().slice(0, 10) : null,
            lastUpdatedAt: r?.maxUpdated ? r.maxUpdated.toISOString() : null,
            dataSourcesCount: Number(r?.dsCount || 0),
        };
    }
    return NextResponse.json({
        provider: cfg,
        artifacts: {
            backfillFiles: fileNames,
            mappingMissing,
            linkedProjects,
            mapping: mapping?.kind === 'metrics_links' ? { kind: 'metrics_links', linkType: mappingLinkType, key: mappingKey } : null,
            integration: partnerId
                ? {
                    partnerId,
                    requiredFields,
                    configured: !!cred && (cred?.enabled ?? false) && (missingFields?.length || 0) === 0,
                    enabled: cred?.enabled ?? false,
                    missingFields,
                }
                : null,
            stats,
            tasks: {
                backfill: backfillTask,
                sync: syncTask,
            },
        },
    });
}
