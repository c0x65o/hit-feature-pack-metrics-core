import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { computeDimensionsHash } from '../lib/dimensions';
import { getAuthContext } from '../lib/authz';
import { metricsDataSources, metricsIngestBatches, metricsLinks, metricsMetricPoints } from '@/lib/feature-pack-schemas';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Bigger batches drastically reduce DB round-trips for large Steam exports
// (some sales CSVs can generate 100k+ metric_point rows after aggregation).
// Keep under Postgres' 65535 parameter limit (row has ~11 columns).
const METRIC_POINT_UPSERT_CHUNK_SIZE = 2500;
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
function loadIngestorOrThrow(id) {
    const { dir, checked } = findIngestorsDir(appRoot());
    if (!dir) {
        throw new Error(`Ingestors directory not found. Checked:\n` + checked.map((p) => `- ${p}`).join('\n'));
    }
    const files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
        .map((e) => path.join(dir, e.name));
    for (const f of files) {
        const raw = fs.readFileSync(f, 'utf8');
        const cfg = yaml.load(raw);
        if (cfg?.id === id)
            return cfg;
    }
    throw new Error(`Unknown ingestor: ${id}`);
}
function parseCSVLine(line) {
    const values = [];
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
function parseDateOnly(raw) {
    const s = raw.trim();
    if (!s)
        return null;
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
function parseMaybeNumber(raw) {
    const s0 = String(raw ?? '').trim();
    if (!s0)
        return 0;
    const isParenNeg = /^\(.*\)$/.test(s0);
    const s1 = s0.replace(/^\(|\)$/g, '');
    const cleaned = s1.replace(/[^0-9.\-]/g, '');
    if (!cleaned)
        return 0;
    const n = Number.parseFloat(cleaned);
    if (Number.isNaN(n))
        return 0;
    return isParenNeg ? -Math.abs(n) : n;
}
function findHeaderStartLine(lines) {
    for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        // Support both formats:
        // 1. Sales format: Date, Product, Bundle (e.g., "Shores Unknown - Sales Data.csv")
        // 2. In-Game Sales format: Date, Product (e.g., "Stan Lees Verticus - Sales Data.csv")
        if (lower.includes('date') && lower.includes('product'))
            return i;
    }
    return -1;
}
function parseSteamDailySales(content, fallbackAppId) {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderStartLine(lines);
    if (headerIdx < 0)
        throw new Error('Could not find header row in CSV');
    const header = parseCSVLine(lines[headerIdx] ?? '').map((h) => h.trim());
    const headerLower = header.map((h) => h.toLowerCase());
    const idx = (pred) => {
        for (let i = 0; i < headerLower.length; i++)
            if (pred(headerLower[i], i))
                return i;
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
    if (dateIdx === null)
        throw new Error('Missing Date column in CSV');
    // Aggregate by (date, steam_app_id, platform, region, country_code, country)
    const agg = new Map();
    let minDate = null;
    let maxDate = null;
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line)
            continue;
        if (line.toLowerCase().startsWith('sep='))
            continue;
        const row = parseCSVLine(line);
        if (dateIdx >= row.length)
            continue;
        const dt = parseDateOnly(row[dateIdx] ?? '');
        if (!dt)
            continue;
        if (!minDate || dt < minDate)
            minDate = dt;
        if (!maxDate || dt > maxDate)
            maxDate = dt;
        const getStr = (j) => (j === null || j >= row.length ? '' : String(row[j] ?? '').trim());
        const platform = getStr(platformIdx) || 'steam';
        const country = getStr(countryIdx);
        const countryCode = getStr(countryCodeIdx);
        const region = getStr(regionIdx);
        const currency = getStr(currencyIdx);
        const tag = getStr(tagIdx);
        const type = getStr(typeIdx);
        const game = getStr(gameIdx);
        const productId = getStr(productIdIdx);
        const steamAppId = productId && productId !== '-1' ? productId : fallbackAppId || 'unknown';
        const dims = {
            steam_app_id: String(steamAppId),
            platform: String(platform),
            region: String(region),
            country: String(country),
            country_code: String(countryCode),
            currency: String(currency),
            tag: String(tag),
            type: String(type),
            game: String(game),
        };
        const key = `${dt.toISOString().slice(0, 10)}|${dims.steam_app_id}|${dims.platform}|${dims.region}|${dims.country_code}|${dims.country}`;
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
function findHeaderStartLineWishlist(lines) {
    for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('datelocal') && lower.includes('game') && lower.includes('adds'))
            return i;
    }
    return -1;
}
function parseSteamDailyWishlist(content, steamAppId) {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderStartLineWishlist(lines);
    if (headerIdx < 0)
        throw new Error('Could not find header row in wishlist CSV');
    const header = parseCSVLine(lines[headerIdx] ?? '').map((h) => h.trim());
    const headerLower = header.map((h) => h.toLowerCase().trim());
    const idxExact = (name) => {
        const i = headerLower.indexOf(name);
        return i === -1 ? null : i;
    };
    const dateIdx = idxExact('datelocal');
    const gameIdx = idxExact('game');
    const addsIdx = idxExact('adds');
    const deletesIdx = idxExact('deletes');
    const purchasesIdx = idxExact('purchasesandactivations') ??
        idxExact('purchases and activations') ??
        idxExact('purchases') ??
        idxExact('activations');
    const giftsIdx = idxExact('gifts');
    if (dateIdx === null)
        throw new Error('Missing DateLocal column in wishlist CSV');
    if (addsIdx === null)
        throw new Error('Missing Adds column in wishlist CSV');
    const agg = new Map();
    let minDate = null;
    let maxDate = null;
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line)
            continue;
        if (line.toLowerCase().startsWith('sep='))
            continue;
        const row = parseCSVLine(line);
        if (dateIdx >= row.length)
            continue;
        const dt = parseDateOnly(row[dateIdx] ?? '');
        if (!dt)
            continue;
        if (!minDate || dt < minDate)
            minDate = dt;
        if (!maxDate || dt > maxDate)
            maxDate = dt;
        const getStr = (j) => (j === null || j >= row.length ? '' : String(row[j] ?? '').trim());
        const adds = parseMaybeNumber(getStr(addsIdx));
        const deletes = parseMaybeNumber(getStr(deletesIdx));
        const conversions = parseMaybeNumber(getStr(purchasesIdx));
        const gifts = parseMaybeNumber(getStr(giftsIdx));
        const net = adds - deletes - conversions - gifts;
        const dims = steamAppId ? { steam_app_id: String(steamAppId), platform: 'steam' } : { platform: 'steam' };
        const key = steamAppId ? `${dt.toISOString().slice(0, 10)}|${String(steamAppId)}` : `${dt.toISOString().slice(0, 10)}`;
        const existing = agg.get(key);
        const sums = existing?.sums || {
            wishlist_adds: 0,
            wishlist_deletes: 0,
            wishlist_conversions: 0,
            wishlist_gifts: 0,
            wishlist_net_change: 0,
        };
        sums.wishlist_adds += adds;
        sums.wishlist_deletes += deletes;
        sums.wishlist_conversions += conversions;
        sums.wishlist_gifts += gifts;
        sums.wishlist_net_change += net;
        agg.set(key, { dims, sums, date: dt });
    }
    return { agg, minDate, maxDate };
}
function findHeaderStartLinePlayerData(lines) {
    for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('datereported') && lower.includes('dailyactiveusers'))
            return i;
    }
    return -1;
}
function parseSteamDailyPlayerData(content, steamAppId) {
    const lines = content.split(/\r?\n/);
    const headerIdx = findHeaderStartLinePlayerData(lines);
    if (headerIdx < 0)
        throw new Error('Could not find header row in player data CSV');
    const header = parseCSVLine(lines[headerIdx] ?? '').map((h) => h.trim());
    const headerLower = header.map((h) => h.toLowerCase().trim());
    const idxExact = (name) => {
        const i = headerLower.indexOf(name);
        return i === -1 ? null : i;
    };
    const dateIdx = idxExact('datereported');
    const dauIdx = idxExact('dailyactiveusers');
    const pcuIdx = idxExact('peakconcurrentusers');
    if (dateIdx === null)
        throw new Error('Missing DateReported column in player data CSV');
    const agg = new Map();
    let minDate = null;
    let maxDate = null;
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line)
            continue;
        if (line.toLowerCase().startsWith('sep='))
            continue;
        const row = parseCSVLine(line);
        if (dateIdx >= row.length)
            continue;
        const dt = parseDateOnly(row[dateIdx] ?? '');
        if (!dt)
            continue;
        if (!minDate || dt < minDate)
            minDate = dt;
        if (!maxDate || dt > maxDate)
            maxDate = dt;
        const getStr = (j) => (j === null || j >= row.length ? '' : String(row[j] ?? '').trim());
        const dau = parseMaybeNumber(getStr(dauIdx));
        const pcu = parseMaybeNumber(getStr(pcuIdx));
        const dims = steamAppId ? { steam_app_id: String(steamAppId), platform: 'steam' } : { platform: 'steam' };
        const key = steamAppId ? `${dt.toISOString().slice(0, 10)}|${String(steamAppId)}` : `${dt.toISOString().slice(0, 10)}`;
        const existing = agg.get(key);
        const sums = existing?.sums || { daily_active_users: 0, peak_concurrent_users: 0 };
        // Some exports can contain duplicates; max is safer than sum.
        sums.daily_active_users = Math.max(Number(sums.daily_active_users || 0), dau);
        sums.peak_concurrent_users = Math.max(Number(sums.peak_concurrent_users || 0), pcu);
        agg.set(key, { dims, sums, date: dt });
    }
    return { agg, minDate, maxDate };
}
function inferSteamAppIdFromParsed(parsed) {
    const ids = new Set();
    for (const entry of parsed.agg.values()) {
        const appId = String(entry?.dims?.steam_app_id || '').trim();
        if (appId)
            ids.add(appId);
    }
    if (ids.size === 1)
        return Array.from(ids)[0];
    return null;
}
function cryptoRandomId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
// NOTE: This API must remain generic. App-specific link enrichment (e.g. resolving external IDs
// into form entries) should be performed by the application layer, not here.
export async function POST(request, ctx) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const ingestorId = ctx.params.id;
    try {
        let cfg;
        try {
            cfg = loadIngestorOrThrow(ingestorId);
        }
        catch (e) {
            return jsonError(e instanceof Error ? e.message : 'Unknown ingestor', 404);
        }
        if (!cfg.upload?.enabled)
            return jsonError(`Upload is disabled for ingestor: ${ingestorId}`, 400);
        if (!cfg.upload.mapping || cfg.upload.mapping.kind !== 'metrics_links') {
            return jsonError('Upload mapping must be configured (mapping.kind=metrics_links)', 400);
        }
        const mappingKey = (cfg.upload.mapping.key || 'exact_filename');
        if (mappingKey !== 'exact_filename' && mappingKey !== 'normalize_steam_sales') {
            return jsonError(`Unsupported upload mapping.key: ${mappingKey}`, 400);
        }
        const form = await request.formData().catch(() => null);
        if (!form)
            return jsonError('Invalid multipart form data', 400);
        const f = form.get('file');
        if (!(f instanceof File))
            return jsonError('Missing file', 400);
        const overwrite = String(form.get('overwrite') ?? '').toLowerCase() === 'true';
        const fileName = f.name || 'upload.csv';
        const fileSize = Number(f.size || 0);
        const buf = Buffer.from(await f.arrayBuffer());
        const content = buf.toString('utf8');
        const db = getDb();
        const now = new Date();
        const linkType = cfg.upload.mapping.link_type;
        // If mapping.key is "exact_filename", attempt filename -> steam_app_id. If missing, we can still infer from CSV.
        // If mapping.key is "normalize_steam_sales", normalize common Steam export filename variants before lookup,
        // and still fall back to CSV inference.
        let mappingLookupKey = fileName;
        if (mappingKey === 'normalize_steam_sales') {
            mappingLookupKey = fileName.replace(/\.csv$/i, '').replace(/ - sales data$/i, '').trim().toLowerCase();
        }
        const linkRow = await db
            .select({ metadata: metricsLinks.metadata, targetKind: metricsLinks.targetKind, targetId: metricsLinks.targetId })
            .from(metricsLinks)
            .where(and(eq(metricsLinks.linkType, linkType), eq(metricsLinks.linkId, mappingLookupKey)))
            .orderBy(
        // Prefer mappings that actually have a target (avoid placeholder "none" rows)
        sql `CASE WHEN ${metricsLinks.targetKind} = 'none' THEN 1 ELSE 0 END`, 
        // Prefer field-mapper rows that include steam_app_id (critical for stable revenue joins)
        sql `CASE WHEN coalesce((${metricsLinks.metadata} ->> 'steam_app_id'), '') = '' THEN 1 ELSE 0 END`, 
        // Finally, pick the most recently updated mapping.
        sql `${metricsLinks.updatedAt} DESC`)
            .limit(1);
        const mappedMeta = (linkRow[0]?.metadata || {});
        const mappedTargetKind = typeof linkRow[0]?.targetKind === 'string' ? String(linkRow[0].targetKind).trim() : '';
        const mappedTargetId = typeof linkRow[0]?.targetId === 'string' ? String(linkRow[0].targetId).trim() : '';
        // Parse and aggregate (we use this both for inference and for ingestion).
        let parsed;
        // Resolve file -> entity (canonical linkage for file-based ingestion).
        // This uses metrics_links.target_kind/target_id so the application can map external IDs to any entity in the system.
        if (!mappedTargetKind || mappedTargetKind === 'none' || !mappedTargetId) {
            return jsonError(`Missing mapping target for upload "${fileName}". Add a metrics_links row: link_type="${linkType}", link_id="${mappingLookupKey}", target_kind="<entity kind>", target_id="<entity id>".`, 400);
        }
        // For Steam wishlist/playerdata ingestors, steam_app_id is required for:
        // - stable per-app data_source IDs (overlap policy isolation)
        // - future per-storefront filtering
        //
        // We do NOT use steam_app_id as the entity link (entity is always the project),
        // but we still want it as a dimension.
        const steamAppIdHint = typeof mappedMeta?.steam_app_id === 'string'
            ? mappedMeta.steam_app_id.trim()
            : typeof mappedMeta?.steamAppId === 'string'
                ? mappedMeta.steamAppId.trim()
                : '';
        const inferredSteamAppIdForDims = steamAppIdHint || '';
        if (ingestorId === 'steam-sales') {
            try {
                // IMPORTANT:
                // Some Steam "Sales Data" exports (notably certain in-game sales formats) do not include Product(ID),
                // which would otherwise cause steam_app_id to become "unknown" and break the Projects revenue
                // steam_app_id fallback join. Use the mapped steam_app_id (from metrics_links.metadata) as a
                // fallback so dimensions stay stable across formats.
                parsed = parseSteamDailySales(content, inferredSteamAppIdForDims);
            }
            catch (e) {
                return jsonError(e instanceof Error ? e.message : 'Failed to parse CSV', 400);
            }
        }
        else if (ingestorId === 'steam-wishlist') {
            try {
                parsed = parseSteamDailyWishlist(content, inferredSteamAppIdForDims);
            }
            catch (e) {
                return jsonError(e instanceof Error ? e.message : 'Failed to parse wishlist CSV', 400);
            }
        }
        else if (ingestorId === 'steam-playerdata') {
            try {
                parsed = parseSteamDailyPlayerData(content, inferredSteamAppIdForDims);
            }
            catch (e) {
                return jsonError(e instanceof Error ? e.message : 'Failed to parse player data CSV', 400);
            }
        }
        else {
            return jsonError(`Unsupported ingestor for CSV upload: ${ingestorId}`, 400);
        }
        // Infer steam app id from parsed data for dimension/ID purposes.
        //
        // IMPORTANT:
        // `inferSteamAppIdFromParsed()` may return a value that is NOT the actual Steam AppID for the
        // storefront/project mapping (some Steam exports include other product identifiers).
        //
        // When a metrics_links mapping provides steam_app_id metadata, treat it as authoritative for
        // dimensions + data_source scoping so Projects revenue fallback joins remain stable.
        const inferredFromParsed = inferSteamAppIdFromParsed(parsed) || '';
        const steamAppId = steamAppIdHint || inferredFromParsed || '';
        const entityKind = mappedTargetKind;
        const entityId = mappedTargetId;
        const minDate = parsed.minDate;
        const maxDate = parsed.maxDate;
        if (!minDate || !maxDate)
            return jsonError('No valid daily rows found in CSV', 400);
        function safeIdPart(s, maxLen = 64) {
            return String(s || '')
                .trim()
                .replace(/[^a-zA-Z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, maxLen);
        }
        // Ensure data source exists (orchestrated).
        const ds = cfg.data_source;
        const scope = cfg.scope;
        // IMPORTANT:
        // For file ingestors, we should not use a single global data_source.id for all entities,
        // otherwise overlap policy collides across different entities/files.
        const dsId = `${ds.id}_${safeIdPart(entityKind, 16)}_${safeIdPart(entityId, 48)}_${safeIdPart(steamAppId, 24)}`;
        await db
            .insert(metricsDataSources)
            .values({
            id: dsId,
            entityKind,
            entityId,
            connectorKey: ds.connector_key,
            sourceKind: ds.source_kind,
            externalRef: ds.external_ref ?? null,
            enabled: true,
            createdAt: now,
            updatedAt: now,
        })
            .onConflictDoUpdate({
            target: metricsDataSources.id,
            set: { updatedAt: now },
        });
        // Overlap policy: keep best for exact date range (prefer larger file size)
        if (cfg.upload.overlap_policy?.kind === 'keep_best_for_exact_date_range' && cfg.upload.overlap_policy.prefer === 'larger_file_size') {
            const existing = await db
                .select({
                id: metricsIngestBatches.id,
                fileSize: metricsIngestBatches.fileSize,
            })
                .from(metricsIngestBatches)
                .where(and(eq(metricsIngestBatches.dataSourceId, dsId), eq(metricsIngestBatches.type, 'csv_upload'), eq(metricsIngestBatches.dateRangeStart, minDate), eq(metricsIngestBatches.dateRangeEnd, maxDate)))
                .limit(1);
            const prev = existing[0];
            if (prev && !overwrite) {
                const prevSize = Number(prev.fileSize || 0);
                if (prevSize >= fileSize) {
                    return jsonError(`A batch already exists for this exact date range (${minDate.toISOString().slice(0, 10)} → ${maxDate.toISOString().slice(0, 10)}). Existing file is larger/equal (${prevSize} bytes) so this upload is skipped. Check "overwrite" to force.`, 409);
                }
            }
        }
        // Overwrite should be a true "delete + replace" operation, not just an upsert.
        //
        // Why:
        // - If a prior ingest inferred the wrong steam_app_id (or otherwise changed dimensions),
        //   the unique key (dimensionsHash) differs, so upsert will NOT replace old rows.
        // - Worse, this upload path historically included steam_app_id in dataSourceId, so bad inference
        //   created different dataSourceIds. Upserting into the "correct" dataSourceId can't touch those rows.
        //
        // Solution:
        // - Find prior csv_upload ingest batches for this same file+entity+connector+dateRange
        // - Delete all metric points for those batches before ingesting the replacement batch.
        if (overwrite) {
            const prevBatches = await db
                .select({
                id: metricsIngestBatches.id,
            })
                .from(metricsIngestBatches)
                .innerJoin(metricsDataSources, eq(metricsIngestBatches.dataSourceId, metricsDataSources.id))
                .where(and(eq(metricsIngestBatches.type, 'csv_upload'), eq(metricsIngestBatches.fileName, fileName), eq(metricsIngestBatches.dateRangeStart, minDate), eq(metricsIngestBatches.dateRangeEnd, maxDate), eq(metricsDataSources.entityKind, entityKind), eq(metricsDataSources.entityId, entityId), eq(metricsDataSources.connectorKey, ds.connector_key), eq(metricsDataSources.sourceKind, ds.source_kind)));
            const prevBatchIds = prevBatches.map((b) => String(b?.id || '')).filter(Boolean);
            if (prevBatchIds.length > 0) {
                await db.delete(metricsMetricPoints).where(inArray(metricsMetricPoints.ingestBatchId, prevBatchIds));
            }
        }
        const ingestBatchId = `mb_${cryptoRandomId()}`;
        await db.insert(metricsIngestBatches).values({
            id: ingestBatchId,
            dataSourceId: dsId,
            type: 'csv_upload',
            fileName,
            fileSize: String(fileSize),
            status: 'success',
            dateRangeStart: minDate,
            dateRangeEnd: maxDate,
            processedAt: now,
            createdAt: now,
            updatedAt: now,
        });
        // Build points and upsert in chunks.
        //
        // IMPORTANT: do NOT build a giant `values[]` list for large files; that can spike memory
        // and (more importantly) makes ingestion slower, which can trigger pod liveness/OOM kills.
        const valuesChunk = [];
        const wishlistNetByDay = new Map();
        let wishlistBaseDimensionsHash = null;
        let wishlistBaseDimensions = null;
        async function flushChunk() {
            if (valuesChunk.length === 0)
                return;
            const chunk = valuesChunk.splice(0, valuesChunk.length);
            await db
                .insert(metricsMetricPoints)
                .values(chunk)
                .onConflictDoUpdate({
                target: [
                    metricsMetricPoints.dataSourceId,
                    metricsMetricPoints.metricKey,
                    metricsMetricPoints.date,
                    metricsMetricPoints.granularity,
                    metricsMetricPoints.dimensionsHash,
                ],
                set: {
                    value: sql `excluded.value`,
                    ingestBatchId: sql `excluded.ingest_batch_id`,
                    updatedAt: now,
                },
            });
        }
        let pointsUpserted = 0;
        for (const entry of parsed.agg.values()) {
            const day = entry.date;
            const dims = { ...(entry.dims || {}) };
            // Ensure mapped steam_app_id wins for dimensions hashing + reporting.
            // This prevents Steam product identifiers (or missing columns) from polluting dimensions and breaking revenue joins.
            if (steamAppIdHint) {
                dims.steam_app_id = steamAppIdHint;
            }
            const dimensionsHash = computeDimensionsHash(dims);
            const base = {
                entityKind,
                entityId,
                dataSourceId: dsId,
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
                valuesChunk.push({
                    ...base,
                    id: `mp_${cryptoRandomId()}`,
                    metricKey,
                    value: String(value),
                });
                pointsUpserted++;
                if (valuesChunk.length >= METRIC_POINT_UPSERT_CHUNK_SIZE) {
                    await flushChunk();
                }
            }
            if (ingestorId === 'steam-wishlist') {
                const dayKey = day.toISOString().slice(0, 10);
                const net = Number(entry.sums?.wishlist_net_change ?? 0);
                wishlistNetByDay.set(dayKey, Number.isFinite(net) ? net : 0);
                wishlistBaseDimensionsHash = dimensionsHash;
                wishlistBaseDimensions = dims;
            }
        }
        // Derived metric: wishlist_cumulative_total.
        // Compute it in the upload handler so it stays consistent across multiple uploads/backfills.
        if (ingestorId === 'steam-wishlist' && wishlistNetByDay.size > 0 && wishlistBaseDimensionsHash && wishlistBaseDimensions) {
            const rows = await db
                .select({
                s: sql `COALESCE(SUM(CAST(${metricsMetricPoints.value} AS NUMERIC)), 0)`.as('s'),
            })
                .from(metricsMetricPoints)
                .where(and(eq(metricsMetricPoints.dataSourceId, dsId), eq(metricsMetricPoints.entityKind, entityKind), eq(metricsMetricPoints.entityId, entityId), eq(metricsMetricPoints.metricKey, 'wishlist_net_change'), sql `${metricsMetricPoints.date} < ${minDate}`, eq(metricsMetricPoints.dimensionsHash, wishlistBaseDimensionsHash)))
                .limit(1);
            const base = Number(rows?.[0]?.s ?? 0);
            let running = Number.isFinite(base) ? base : 0;
            const days = Array.from(wishlistNetByDay.keys()).sort();
            for (const day of days) {
                running += wishlistNetByDay.get(day) || 0;
                const dt = new Date(`${day}T00:00:00.000Z`);
                valuesChunk.push({
                    id: `mp_${cryptoRandomId()}`,
                    entityKind,
                    entityId,
                    dataSourceId: dsId,
                    date: dt,
                    granularity: 'daily',
                    dimensions: wishlistBaseDimensions,
                    dimensionsHash: wishlistBaseDimensionsHash,
                    ingestBatchId,
                    createdAt: now,
                    updatedAt: now,
                    metricKey: 'wishlist_cumulative_total',
                    value: String(running),
                });
                pointsUpserted++;
                if (valuesChunk.length >= METRIC_POINT_UPSERT_CHUNK_SIZE) {
                    await flushChunk();
                }
            }
        }
        await flushChunk();
        return NextResponse.json({
            ok: true,
            ingestorId,
            fileName,
            fileSize,
            resolved: {
                steamAppId: steamAppId,
                targetKind: entityKind,
                targetId: entityId,
            },
            dateRange: { start: minDate.toISOString().slice(0, 10), end: maxDate.toISOString().slice(0, 10) },
            pointsUpserted,
            ingestBatchId,
        });
    }
    catch (e) {
        // Avoid bubbling to the dispatcher generic 500 so callers see a usable error message.
        const msg = e instanceof Error ? e.message : String(e || 'Internal server error');
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
