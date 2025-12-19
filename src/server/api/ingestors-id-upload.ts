import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';
import { computeDimensionsHash } from '../lib/dimensions';
import { getAuthContext } from '../lib/authz';
import { formEntries, metricsDataSources, metricsIngestBatches, metricsLinks, metricsMetricPoints, projects } from '@/lib/feature-pack-schemas';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const METRIC_POINT_UPSERT_CHUNK_SIZE = 400;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type IngestorConfig = {
  id: string;
  label?: string;
  description?: string;
  metrics?: string[];
  data_source: { id: string; connector_key: string; source_kind: string; external_ref?: string | null };
  scope: { entity_kind: string; entity_id: string };
  upload?: {
    enabled?: boolean;
    mapping?: { kind: 'metrics_links'; link_type: string; key?: 'exact_filename' | 'normalize_steam_sales' };
    overlap_policy?: { kind: 'keep_best_for_exact_date_range'; prefer: 'larger_file_size' };
  };
};

function appRoot() {
  return process.cwd();
}

function ingestorsDir() {
  return path.join(appRoot(), '.hit', 'metrics', 'ingestors');
}

function loadIngestorOrThrow(id: string): IngestorConfig {
  const dir = ingestorsDir();
  if (!fs.existsSync(dir)) throw new Error('Ingestors directory not found (.hit/metrics/ingestors)');
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
    .map((e) => path.join(dir, e.name));
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const cfg = (yaml.load(raw) as any) as IngestorConfig;
    if (cfg?.id === id) return cfg;
  }
  throw new Error(`Unknown ingestor: ${id}`);
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseDateOnly(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // Supported: YYYY-MM-DD or MM/DD/YYYY
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m1) {
    const y = Number(m1[1]);
    const mo = Number(m1[2]) - 1;
    const d = Number(m1[3]);
    const dt = new Date(Date.UTC(y, mo, d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m2) {
    const mo = Number(m2[1]) - 1;
    const d = Number(m2[2]);
    const y = Number(m2[3]);
    const dt = new Date(Date.UTC(y, mo, d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function parseMaybeNumber(raw: string): number {
  const s0 = String(raw ?? '').trim();
  if (!s0) return 0;
  const isParenNeg = /^\(.*\)$/.test(s0);
  const s1 = s0.replace(/^\(|\)$/g, '');
  const cleaned = s1.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n)) return 0;
  return isParenNeg ? -Math.abs(n) : n;
}

function findHeaderStartLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('date') && lower.includes('product') && lower.includes('bundle')) return i;
  }
  return -1;
}

function parseSteamDailySales(content: string, fallbackAppId: string) {
  const lines = content.split(/\r?\n/);
  const headerIdx = findHeaderStartLine(lines);
  if (headerIdx < 0) throw new Error('Could not find header row in CSV');

  const header = parseCSVLine(lines[headerIdx] ?? '').map((h) => h.trim());
  const headerLower = header.map((h) => h.toLowerCase());

  const idx = (pred: (h: string, i: number) => boolean): number | null => {
    for (let i = 0; i < headerLower.length; i++) if (pred(headerLower[i]!, i)) return i;
    return null;
  };

  const dateIdx = idx((h) => h === 'date' || h.startsWith('date'));
  const platformIdx = idx((h) => h === 'platform');
  const countryIdx = idx((h) => h === 'country');
  const countryCodeIdx = idx((h) => h.includes('country') && h.includes('code'));
  const regionIdx = idx((h) => h === 'region');
  const currencyIdx = idx((h) => h === 'currency');
  const tagIdx = idx((h) => h === 'tag');
  const typeIdx = idx((h) => h === 'type');
  const gameIdx = idx((h) => h === 'game');
  const productIdIdx = idx((h) => h.includes('product(id'));

  const grossUnitsIdx = idx((h) => h.includes('gross units sold'));
  const netUnitsIdx = idx((h) => h.includes('net units sold'));
  const refundsIdx = idx((h) => h.includes('chargeback/returns') && !h.includes('usd'));
  const grossSalesIdx = idx((h) => h.includes('gross steam sales') && h.includes('usd'));
  const netSalesIdx = idx((h) => h.includes('net steam sales') && h.includes('usd'));
  const refundSalesIdx = idx((h) => h.includes('chargeback/returns') && h.includes('usd'));
  const vatTaxIdx = idx((h) => h.includes('vat/tax') && h.includes('usd'));

  if (dateIdx === null) throw new Error('Missing Date column in CSV');

  // Aggregate by (date, app_id, platform, region, country_code, country)
  const agg = new Map<string, { dims: any; sums: Record<string, number>; date: Date }>();
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('sep=')) continue;
    const row = parseCSVLine(line);
    if (dateIdx >= row.length) continue;

    const dt = parseDateOnly(row[dateIdx] ?? '');
    if (!dt) continue;

    if (!minDate || dt < minDate) minDate = dt;
    if (!maxDate || dt > maxDate) maxDate = dt;

    const getStr = (j: number | null) => (j === null || j >= row.length ? '' : String(row[j] ?? '').trim());
    const platform = getStr(platformIdx) || 'steam';
    const country = getStr(countryIdx);
    const countryCode = getStr(countryCodeIdx);
    const region = getStr(regionIdx);
    const currency = getStr(currencyIdx);
    const tag = getStr(tagIdx);
    const type = getStr(typeIdx);
    const game = getStr(gameIdx);

    const productId = getStr(productIdIdx);
    const appId = productId && productId !== '-1' ? productId : fallbackAppId;

    const dims = {
      app_id: String(appId),
      platform: String(platform),
      region: String(region),
      country: String(country),
      country_code: String(countryCode),
      currency: String(currency),
      tag: String(tag),
      type: String(type),
      game: String(game),
    };

    const key = `${dt.toISOString().slice(0, 10)}|${dims.app_id}|${dims.platform}|${dims.region}|${dims.country_code}|${dims.country}`;
    const existing = agg.get(key);
    const sums = existing?.sums || {
      revenue_usd: 0,
      units_sold: 0,
      gross_revenue_usd: 0,
      gross_units_sold: 0,
      refunds: 0,
      refund_amount_usd: 0,
      vat_tax_usd: 0,
    };

    sums.gross_units_sold += parseMaybeNumber(getStr(grossUnitsIdx));
    sums.units_sold += parseMaybeNumber(getStr(netUnitsIdx));
    sums.refunds += parseMaybeNumber(getStr(refundsIdx));
    sums.gross_revenue_usd += parseMaybeNumber(getStr(grossSalesIdx));
    sums.revenue_usd += parseMaybeNumber(getStr(netSalesIdx));
    sums.refund_amount_usd += parseMaybeNumber(getStr(refundSalesIdx));
    sums.vat_tax_usd += parseMaybeNumber(getStr(vatTaxIdx));

    agg.set(key, { dims, sums, date: dt });
  }

  return { agg, minDate, maxDate };
}

function inferSteamAppIdFromParsed(parsed: ReturnType<typeof parseSteamDailySales>): string | null {
  const ids = new Set<string>();
  for (const entry of parsed.agg.values()) {
    const appId = String((entry as any)?.dims?.app_id || '').trim();
    if (appId) ids.add(appId);
  }
  if (ids.size === 1) return Array.from(ids)[0]!;
  return null;
}

function cryptoRandomId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isUuidLike(input: string): boolean {
  const s = input.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function deterministicProjectUuidFromLegacyId(oldId: string): string {
  const hex = crypto.createHash('md5').update(`${oldId}projects`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function tryUpsertSteamAppLinkFromStorefronts(args: { db: any; steamAppId: string; now: Date }) {
  const { db, steamAppId, now } = args;
  const STORE_FRONTS_FORM_ID = 'form_storefronts';

  // Find a storefront entry with platform=steam and store_id=<steam_app_id>
  // Data shape (from forms seed): { project: { entityKind, entityId, label }, platform, store_id, is_active, ... }
  const rows = await db
    .select({
      id: formEntries.id,
      data: formEntries.data,
    })
    .from(formEntries)
    .where(and(eq(formEntries.formId, STORE_FRONTS_FORM_ID), sql`(${formEntries.data}->>'platform') = 'steam'`, sql`(${formEntries.data}->>'store_id') = ${steamAppId}`) as any)
    .limit(25);

  for (const r of rows as any[]) {
    const data = (r?.data || {}) as any;
    const isActive = data.is_active === undefined ? true : Boolean(data.is_active);
    if (!isActive) continue;
    const proj = data.project;
    const rawProjectId = proj && typeof proj === 'object' && typeof proj.entityId === 'string' ? String(proj.entityId) : null;
    if (!rawProjectId) continue;

    // Seeded form entries sometimes contain legacy marketing IDs like "proj_3e0b9c27".
    // Normalize to the Projects feature pack UUIDs (matches the deterministic UUID logic in 020_projects_feature_pack.sql).
    const projectId = isUuidLike(rawProjectId) ? rawProjectId : deterministicProjectUuidFromLegacyId(rawProjectId);

    const projectRows = await db
      .select({ id: projects.id, slug: projects.slug })
      .from(projects)
      .where(eq(projects.id as any, projectId as any) as any)
      .limit(1);
    const projectSlug = projectRows[0]?.slug ? String(projectRows[0].slug) : null;

    const metadata = {
      source: 'forms',
      form_id: STORE_FRONTS_FORM_ID,
      entry_id: r.id,
      legacy_project_id: isUuidLike(rawProjectId) ? null : rawProjectId,
      project_slug: projectSlug,
      game_id: typeof data.game_id === 'string' ? data.game_id : null,
      store_url: typeof data.store_url === 'string' ? data.store_url : null,
      platform: 'steam',
      type: 'game',
    };

    await db
      .insert(metricsLinks as any)
      .values({
        id: `mlink_${cryptoRandomId()}`,
        linkType: 'steam.app',
        linkId: steamAppId,
        targetKind: 'project',
        targetId: projectId,
        metadata,
        createdAt: now,
        updatedAt: now,
      } as any)
      .onConflictDoUpdate({
        target: [
          (metricsLinks as any).linkType,
          (metricsLinks as any).linkId,
          (metricsLinks as any).targetKind,
          (metricsLinks as any).targetId,
        ],
        set: {
          metadata: sql`excluded.metadata`,
          updatedAt: now,
        } as any,
      });

    return { projectId, projectSlug, metadata };
  }

  return null;
}

export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  const auth = getAuthContext(request);
  if (!auth) return jsonError('Unauthorized', 401);

  const ingestorId = ctx.params.id;
  let cfg: IngestorConfig;
  try {
    cfg = loadIngestorOrThrow(ingestorId);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Unknown ingestor', 404);
  }

  if (!cfg.upload?.enabled) return jsonError(`Upload is disabled for ingestor: ${ingestorId}`, 400);
  if (!cfg.upload.mapping || cfg.upload.mapping.kind !== 'metrics_links') {
    return jsonError('Upload mapping must be configured (mapping.kind=metrics_links)', 400);
  }
  const mappingKey = (cfg.upload.mapping.key || 'exact_filename') as 'exact_filename' | 'normalize_steam_sales';
  if (mappingKey !== 'exact_filename' && mappingKey !== 'normalize_steam_sales') {
    return jsonError(`Unsupported upload mapping.key: ${mappingKey}`, 400);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError('Invalid multipart form data', 400);

  const f = form.get('file');
  if (!(f instanceof File)) return jsonError('Missing file', 400);

  const overwrite = String(form.get('overwrite') ?? '').toLowerCase() === 'true';
  const fileName = f.name || 'upload.csv';
  const fileSize = Number(f.size || 0);

  const buf = Buffer.from(await f.arrayBuffer());
  const content = buf.toString('utf8');

  const db = getDb();
  const now = new Date();

  let steamAppId = '';
  const linkType = cfg.upload.mapping.link_type;

  // If mapping.key is "exact_filename", attempt filename -> steam_app_id. If missing, we can still infer from CSV.
  // If mapping.key is "normalize_steam_sales", normalize common Steam export filename variants before lookup,
  // and still fall back to CSV inference.
  let mappingLookupKey = fileName;
  if (mappingKey === 'normalize_steam_sales') {
    mappingLookupKey = fileName.replace(/\.csv$/i, '').replace(/ - sales data$/i, '').trim().toLowerCase();
  }

  const linkRow = await db
    .select({ metadata: metricsLinks.metadata })
    .from(metricsLinks)
    .where(and(eq(metricsLinks.linkType, linkType), eq(metricsLinks.linkId, mappingLookupKey)) as any)
    .limit(1);

  const mappedMeta = (linkRow[0]?.metadata || {}) as any;
  const mappedSteamAppId =
    typeof mappedMeta?.steam_app_id === 'string' ? mappedMeta.steam_app_id : String(mappedMeta?.steam_app_id || '');

  // Parse and aggregate (we use this both for inference and for ingestion).
  let parsed: ReturnType<typeof parseSteamDailySales>;
  try {
    parsed = parseSteamDailySales(content, mappedSteamAppId.trim());
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Failed to parse CSV', 400);
  }

  // Prefer inferred app_id from CSV contents (Steam exports usually include ProductID).
  // Fall back to filename mapping metadata for older/odd exports.
  steamAppId = inferSteamAppIdFromParsed(parsed) || mappedSteamAppId.trim();
  if (!steamAppId) {
    return jsonError(
      `Could not determine steam_app_id for upload "${fileName}". Either add a mapping in metrics_links (link_type="${linkType}", link_id="${mappingLookupKey}", metadata.steam_app_id), or ensure the CSV includes a ProductID column with a single Steam App ID.`,
      400,
    );
  }

  // Resolve steam_app_id -> project (and optional grouping metadata) via metrics_links.
  let steamAppLinks = await db
    .select({
      targetId: metricsLinks.targetId,
      metadata: metricsLinks.metadata,
    })
    .from(metricsLinks)
    .where(and(eq(metricsLinks.linkType, 'steam.app'), eq(metricsLinks.linkId, steamAppId.trim()), eq(metricsLinks.targetKind, 'project')) as any)
    .limit(1);

  // If not linked yet, try to provision the link from the Storefronts form entry (Steam platform).
  if ((steamAppLinks as any[]).length === 0) {
    await tryUpsertSteamAppLinkFromStorefronts({ db, steamAppId: steamAppId.trim(), now });
    steamAppLinks = await db
      .select({
        targetId: metricsLinks.targetId,
        metadata: metricsLinks.metadata,
      })
      .from(metricsLinks)
      .where(and(eq(metricsLinks.linkType, 'steam.app'), eq(metricsLinks.linkId, steamAppId.trim()), eq(metricsLinks.targetKind, 'project')) as any)
      .limit(1);
  }

  const steamAppLink = steamAppLinks[0] as any;
  const linkedProjectId =
    typeof steamAppLink?.targetId === 'string' && steamAppLink.targetId.trim() ? steamAppLink.targetId.trim() : null;
  const steamMeta = (steamAppLink?.metadata || {}) as any;
  const linkedProjectSlug = typeof steamMeta?.project_slug === 'string' ? steamMeta.project_slug : null;
  const steamProductType = typeof steamMeta?.type === 'string' ? steamMeta.type : typeof steamMeta?.source === 'string' ? steamMeta.source : 'game';
  const steamProductName = typeof steamMeta?.name === 'string' ? steamMeta.name : '';

  // For metrics-core v1: prefer scoping the metrics points to the linked project.
  // If no project link exists, fall back to the ingestor's static scope.
  const entityKind = linkedProjectId ? 'project' : cfg.scope.entity_kind;
  const entityId = linkedProjectId ? linkedProjectId : cfg.scope.entity_id;

  const minDate = parsed.minDate;
  const maxDate = parsed.maxDate;
  if (!minDate || !maxDate) return jsonError('No valid daily rows found in CSV', 400);

  // Ensure data source exists (orchestrated).
  const ds = cfg.data_source;
  const scope = cfg.scope;
  await db
    .insert(metricsDataSources as any)
    .values({
      id: ds.id,
      entityKind,
      entityId,
      connectorKey: ds.connector_key,
      sourceKind: ds.source_kind,
      externalRef: ds.external_ref ?? null,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    } as any)
    .onConflictDoUpdate({
      target: (metricsDataSources as any).id,
      set: { updatedAt: now } as any,
    });

  // Overlap policy: keep best for exact date range (prefer larger file size)
  if (cfg.upload.overlap_policy?.kind === 'keep_best_for_exact_date_range' && cfg.upload.overlap_policy.prefer === 'larger_file_size') {
    const existing = await db
      .select({
        id: metricsIngestBatches.id,
        fileSize: metricsIngestBatches.fileSize,
      })
      .from(metricsIngestBatches)
      .where(
        and(
          eq(metricsIngestBatches.dataSourceId, ds.id),
          eq(metricsIngestBatches.type, 'csv_upload' as any),
          eq(metricsIngestBatches.dateRangeStart, minDate as any),
          eq(metricsIngestBatches.dateRangeEnd, maxDate as any),
        ) as any,
      )
      .limit(1);

    const prev = existing[0] as any;
    if (prev && !overwrite) {
      const prevSize = Number(prev.fileSize || 0);
      if (prevSize >= fileSize) {
        return jsonError(
          `A batch already exists for this exact date range (${minDate.toISOString().slice(0, 10)} → ${maxDate.toISOString().slice(0, 10)}). Existing file is larger/equal (${prevSize} bytes) so this upload is skipped. Check "overwrite" to force.`,
          409,
        );
      }
    }
  }

  const ingestBatchId = `mb_${cryptoRandomId()}`;

  await db.insert(metricsIngestBatches as any).values({
    id: ingestBatchId,
    dataSourceId: ds.id,
    type: 'csv_upload',
    fileName,
    fileSize: String(fileSize),
    status: 'success',
    dateRangeStart: minDate,
    dateRangeEnd: maxDate,
    processedAt: now,
    createdAt: now,
    updatedAt: now,
  } as any);

  // Build points list and upsert in chunks.
  const values: any[] = [];
  for (const entry of parsed.agg.values()) {
    const day = entry.date;
    const dims = {
      ...(entry.dims || {}),
      steam_app_id: String(steamAppId.trim()),
      steam_product_type: String(steamProductType || 'game'),
      ...(steamProductName ? { steam_product_name: steamProductName } : {}),
    };
    const dimensionsHash = computeDimensionsHash(dims);
    const base = {
      entityKind,
      entityId,
      dataSourceId: ds.id,
      date: day,
      granularity: 'daily',
      dimensions: dims,
      dimensionsHash,
      ingestBatchId,
      createdAt: now,
      updatedAt: now,
    };

    for (const [metricKey, value] of Object.entries(entry.sums)) {
      // Keep everything (including zeros) for deterministic upserts; can be filtered later.
      values.push({
        ...base,
        id: `mp_${cryptoRandomId()}`,
        metricKey,
        value: String(value),
      });
    }
  }

  for (let i = 0; i < values.length; i += METRIC_POINT_UPSERT_CHUNK_SIZE) {
    const chunk = values.slice(i, i + METRIC_POINT_UPSERT_CHUNK_SIZE);
    await db
      .insert(metricsMetricPoints as any)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          (metricsMetricPoints as any).dataSourceId,
          (metricsMetricPoints as any).metricKey,
          (metricsMetricPoints as any).date,
          (metricsMetricPoints as any).granularity,
          (metricsMetricPoints as any).dimensionsHash,
        ],
        set: {
          value: sql`excluded.value`,
          ingestBatchId: sql`excluded.ingest_batch_id`,
          updatedAt: now,
        } as any,
      });
  }

  return NextResponse.json({
    ok: true,
    ingestorId,
    fileName,
    fileSize,
    resolved: {
      steamAppId: steamAppId.trim(),
      projectId: linkedProjectId,
      projectSlug: linkedProjectSlug,
      group: steamProductType,
    },
    dateRange: { start: minDate.toISOString().slice(0, 10), end: maxDate.toISOString().slice(0, 10) },
    pointsUpserted: values.length,
    ingestBatchId,
  });
}


