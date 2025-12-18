import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions } from '../lib/partners';
import { metricsDataSources, metricsLinks, metricsMetricPoints, metricsPartnerCredentials } from '@/lib/feature-pack-schemas';

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
  tasks?: { sync?: string; backfill?: string };
  upload?: {
    enabled?: boolean;
    mapping?: { kind?: string; link_type?: string; key?: string };
  };
  backfill?: {
    enabled?: boolean;
    kind?: string;
    dir?: string;
    pattern?: string;
    validate_mappings?: boolean;
    command?: string;
  };
  integration?: {
    partner_id?: string;
    required?: boolean;
  };
};

function appRoot() {
  return process.cwd();
}

function loadHitYamlTasks(): Record<string, { command?: string; description?: string }> {
  const p = path.join(appRoot(), 'hit.yaml');
  if (!fs.existsSync(p)) return {};
  const raw = fs.readFileSync(p, 'utf8');
  const doc = (yaml.load(raw) as any) || {};
  const tasks = (doc.tasks as any) || {};
  if (!tasks || typeof tasks !== 'object') return {};
  return tasks as any;
}

function resolveTask(
  name: string | null | undefined,
  tasks: Record<string, { command?: string; description?: string }>,
): { name: string; command: string; description: string | null } | null {
  if (!name) return null;
  const t = tasks[name];
  const cmd = typeof t?.command === 'string' ? t.command : '';
  if (!cmd.trim()) return null;
  return { name, command: cmd, description: (t?.description as string) || null };
}

function findBackfillTask(
  ingestorId: string,
  tasks: Record<string, { command?: string; description?: string }>,
): { name: string; command: string; description: string | null } | null {
  const needle1 = `metrics-ingestor-backfill.js --id=${ingestorId}`;
  const needle2 = `metrics-ingestor-backfill.js --id ${ingestorId}`;
  for (const [name, cfg] of Object.entries(tasks)) {
    const cmd = cfg?.command || '';
    if (typeof cmd !== 'string') continue;
    if (cmd.includes(needle1) || cmd.includes(needle2)) {
      return { name, command: cmd, description: (cfg?.description as string) || null };
    }
  }
  return null;
}

function ingestorYamlPath(id: string) {
  return path.join(appRoot(), '.hit', 'metrics', 'ingestors', `${id}.yaml`);
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = '^' + escaped.replace(/\*/g, '.*') + '$';
  return new RegExp(re);
}

function listBackfillFilenames(cfg: IngestorConfig, limit = 2000): string[] {
  const b = cfg.backfill;
  if (!b?.enabled || b.kind !== 'directory') return [];
  const dirRel = b.dir || '';
  if (!dirRel) return [];
  const dirAbs = path.isAbsolute(dirRel) ? dirRel : path.join(appRoot(), dirRel);
  if (!fs.existsSync(dirAbs)) return [];
  const pat = b.pattern || '*';
  const re = globToRegex(pat);
  return fs
    .readdirSync(dirAbs, { withFileTypes: true })
    .filter((e) => e.isFile() && re.test(e.name))
    .map((e) => e.name)
    .slice(0, limit);
}

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  const auth = getAuthContext(request);
  if (!auth) return jsonError('Unauthorized', 401);

  const id = ctx.params.id;
  const p = ingestorYamlPath(id);
  if (!fs.existsSync(p)) return jsonError(`Unknown provider/ingestor: ${id}`, 404);

  const raw = fs.readFileSync(p, 'utf8');
  const cfg = (yaml.load(raw) as IngestorConfig) || null;
  if (!cfg || !cfg.id) return jsonError(`Invalid ingestor config: ${p}`, 500);

  const db = getDb();
  const tasks = loadHitYamlTasks();
  const backfillTask = resolveTask(cfg.tasks?.backfill, tasks) || findBackfillTask(cfg.id, tasks);
  const syncTask = resolveTask(cfg.tasks?.sync, tasks);

  const fileNames = listBackfillFilenames(cfg);
  const mapping = cfg.upload?.mapping;
  let mappingMissing: string[] = [];
  const mappingLinkType = mapping?.kind === 'metrics_links' ? mapping.link_type || null : null;
  const mappingKey = mapping?.kind === 'metrics_links' ? mapping.key || 'exact_filename' : null;

  if (cfg.backfill?.enabled && cfg.backfill.kind === 'directory' && mapping?.kind === 'metrics_links') {
    const validate = cfg.backfill.validate_mappings !== false;
    const linkType = mapping.link_type || '';
    const key = mapping.key || 'exact_filename';
    if (validate && linkType && key === 'exact_filename' && fileNames.length > 0) {
      const existing = await db
        .select({ linkId: metricsLinks.linkId })
        .from(metricsLinks)
        .where(and(eq(metricsLinks.linkType, linkType), inArray(metricsLinks.linkId as any, fileNames as any)) as any)
        .limit(5000);
      const have = new Set(existing.map((r: { linkId: string }) => r.linkId));
      mappingMissing = fileNames.filter((n) => !have.has(n));
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
        const v = (cred.credentials as any)?.[k];
        return v === null || v === undefined || (typeof v === 'string' && !v.trim());
      })
    : requiredFields;

  // stats
  const dataSourceId = cfg.data_source?.id || null;
  const connectorKey = cfg.data_source?.connector_key || null;
  let stats: any = null;
  if (dataSourceId && Array.isArray(cfg.metrics) && cfg.metrics.length > 0) {
    const rows = await db
      .select({
        c: sql<number>`count(*)`.as('c'),
        minDate: sql<Date | null>`min(${metricsMetricPoints.date})`.as('min_date'),
        maxDate: sql<Date | null>`max(${metricsMetricPoints.date})`.as('max_date'),
        maxUpdated: sql<Date | null>`max(${metricsMetricPoints.updatedAt})`.as('max_updated'),
      })
      .from(metricsMetricPoints)
      .where(and(eq(metricsMetricPoints.dataSourceId, dataSourceId), inArray(metricsMetricPoints.metricKey as any, cfg.metrics as any)) as any);
    const r = rows[0];
    stats = {
      pointsCount: Number(r?.c || 0),
      firstPointDate: r?.minDate ? r.minDate.toISOString().slice(0, 10) : null,
      lastPointDate: r?.maxDate ? r.maxDate.toISOString().slice(0, 10) : null,
      lastUpdatedAt: r?.maxUpdated ? r.maxUpdated.toISOString() : null,
      dataSourcesCount: 1,
    };
  } else if (connectorKey && Array.isArray(cfg.metrics) && cfg.metrics.length > 0) {
    const rows = await db
      .select({
        dsCount: sql<number>`count(distinct ${metricsDataSources.id})`.as('ds_count'),
        pCount: sql<number>`count(${metricsMetricPoints.id})`.as('p_count'),
        minDate: sql<Date | null>`min(${metricsMetricPoints.date})`.as('min_date'),
        maxDate: sql<Date | null>`max(${metricsMetricPoints.date})`.as('max_date'),
        maxUpdated: sql<Date | null>`max(${metricsMetricPoints.updatedAt})`.as('max_updated'),
      })
      .from(metricsMetricPoints)
      .innerJoin(metricsDataSources, eq(metricsMetricPoints.dataSourceId, metricsDataSources.id))
      .where(and(eq(metricsDataSources.connectorKey, connectorKey), inArray(metricsMetricPoints.metricKey as any, cfg.metrics as any)) as any);
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
      mapping: mapping?.kind === 'metrics_links' ? { kind: 'metrics_links', linkType: mappingLinkType, key: mappingKey } : null,
      integration: partnerId
        ? {
            partnerId,
            requiredFields,
            configured: !!cred,
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


