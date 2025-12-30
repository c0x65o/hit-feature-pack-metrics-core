import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints, metricsSegments } from '@/lib/feature-pack-schemas';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { authQuery } from '../lib/auth-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireUserOrService(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return { ok: false as const, res: jsonError('Unauthorized', 401) };
  if (auth.kind === 'service') return { ok: true as const };
  return { ok: true as const };
}

type MetricAgg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
type Op = '>=' | '>' | '<=' | '<' | '==' | '!=';
type WindowPreset = 'all_time' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'month_to_date' | 'year_to_date';

function asNumber(x: unknown): number | null {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function opSql(op: Op, left: any, right: any) {
  if (op === '>=') return sql`${left} >= ${right}`;
  if (op === '>') return sql`${left} > ${right}`;
  if (op === '<=') return sql`${left} <= ${right}`;
  if (op === '<') return sql`${left} < ${right}`;
  if (op === '==') return sql`${left} = ${right}`;
  return sql`${left} != ${right}`;
}

function opMatch(op: Op, left: number, right: number): boolean {
  if (op === '>=') return left >= right;
  if (op === '>') return left > right;
  if (op === '<=') return left <= right;
  if (op === '<') return left < right;
  if (op === '==') return left === right;
  return left !== right;
}

function windowRange(window: unknown): { start: Date | null; end: Date | null } {
  const w = typeof window === 'string' ? (window as WindowPreset) : null;
  if (!w || w === 'all_time') return { start: null, end: null };
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  if (w === 'last_7_days') return { start: new Date(now.getTime() - 7 * dayMs), end: now };
  if (w === 'last_30_days') return { start: new Date(now.getTime() - 30 * dayMs), end: now };
  if (w === 'last_90_days') return { start: new Date(now.getTime() - 90 * dayMs), end: now };
  if (w === 'month_to_date') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    return { start, end: now };
  }
  if (w === 'year_to_date') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    return { start, end: now };
  }
  return { start: null, end: null };
}

type SegmentRule =
  | { kind: 'metric_threshold'; metricKey: string; agg?: MetricAgg; start?: string; end?: string; window?: WindowPreset; op: Op; value: number }
  | { kind: 'static_entity_ids'; entityIds: string[] }
  | { kind: 'all_entities' }
  | { kind: 'entity_attribute'; attribute: 'role' | 'email_verified' | 'locked'; op: '==' | '!='; value: string | boolean }
  | { kind: string; [k: string]: unknown };

type BucketMeta = { segmentKey: string; bucketLabel: string; sortOrder: number };

async function loadBuckets(args: { tableId: string; columnKey: string; entityKind?: string }) {
  const { tableId, columnKey, entityKind } = args;
  const db = getDb();
  const where: any[] = [
    eq(metricsSegments.isActive, true),
    sql`(${metricsSegments.rule} -> 'table' ->> 'tableId') = ${tableId}`,
    sql`(${metricsSegments.rule} -> 'table' ->> 'columnKey') = ${columnKey}`,
  ];
  if (entityKind) where.push(eq(metricsSegments.entityKind, entityKind));
  const rows = await db.select().from(metricsSegments).where(and(...where)).orderBy(asc(metricsSegments.key));
  const out: BucketMeta[] = [];
  for (const r of rows as any[]) {
    const rule = (r?.rule && typeof r.rule === 'object' ? r.rule : null) as any;
    const table = rule?.table && typeof rule.table === 'object' ? rule.table : null;
    const bucketLabel = typeof table?.bucketLabel === 'string' ? table.bucketLabel.trim() : '';
    if (!bucketLabel) continue;
    const sortOrder = Number(table?.sortOrder ?? 0) || 0;
    out.push({ segmentKey: String(r.key || '').trim(), bucketLabel, sortOrder });
  }
  out.sort((a, b) => (a.sortOrder - b.sortOrder) || a.bucketLabel.localeCompare(b.bucketLabel) || a.segmentKey.localeCompare(b.segmentKey));
  return out;
}

async function matchingEntityIdsForSegment(segmentKey: string, entityKind: string, entityIds: string[]): Promise<Set<string>> {
  const db = getDb();
  const segRows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, segmentKey)).limit(1);
  if (!segRows.length) return new Set();
  const seg = segRows[0] as any;
  if (seg.entityKind !== entityKind) return new Set();
  if (seg.isActive === false) return new Set();

  const rule = (seg.rule && typeof seg.rule === 'object' ? seg.rule : null) as SegmentRule | null;
  if (!rule || typeof (rule as any).kind !== 'string') return new Set();

  const ids = entityIds.map((x) => String(x || '').trim()).filter(Boolean);
  if (ids.length === 0) return new Set();
  const idList = ids.map((id) => sql`${id}`);

  if (rule.kind === 'static_entity_ids') {
    const allow = new Set(
      (Array.isArray((rule as any).entityIds) ? (rule as any).entityIds : [])
        .map((x: any) => String(x || '').trim())
        .filter(Boolean)
    );
    return new Set(ids.filter((id) => allow.has(id)));
  }

  if (rule.kind === 'all_entities') {
    if (entityKind !== 'user') return new Set();
    const lower = ids.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
    const terms = lower.map((e) => sql`${e}`);
    const rows = await authQuery<{ email: string }>(
      `select lower(email) as email from hit_auth_users where lower(email) in (${terms.map((_, i) => `$${i + 1}`).join(', ')})`,
      lower
    );
    return new Set(rows.map((r: any) => String(r.email || '').trim().toLowerCase()).filter(Boolean));
  }

  if (rule.kind === 'entity_attribute') {
    if (entityKind !== 'user') return new Set();
    const r = rule as any;
    const attr = String(r.attribute || '').trim();
    const op: '==' | '!=' = r.op === '!=' ? '!=' : '==';
    const expected = r.value;

    const lower = ids.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
    if (lower.length === 0) return new Set();

    const rows = await authQuery<{ email: string; role: string; email_verified: boolean; locked: boolean }>(
      `select lower(email) as email, role, email_verified, locked from hit_auth_users where lower(email) in (${lower.map((_, i) => `$${i + 1}`).join(', ')})`,
      lower
    );
    const matched = new Set<string>();
    for (const u of rows as any[]) {
      const email = String(u.email || '').trim().toLowerCase();
      let actual: any = null;
      if (attr === 'role') actual = typeof u.role === 'string' ? u.role : String(u.role || '');
      else if (attr === 'email_verified') actual = Boolean(u.email_verified);
      else if (attr === 'locked') actual = Boolean(u.locked);
      else continue;
      const ok = op === '==' ? actual === expected : actual !== expected;
      if (ok && email) matched.add(email);
    }
    return matched;
  }

  if (rule.kind === 'metric_threshold') {
    const r = rule as any;
    const metricKey = String(r.metricKey || '').trim();
    if (!metricKey) return new Set();

    let start: Date | null = null;
    let end: Date | null = null;
    if (r.start) {
      start = new Date(r.start);
      if (Number.isNaN(start.getTime())) return new Set();
    }
    if (r.end) {
      end = new Date(r.end);
      if (Number.isNaN(end.getTime())) return new Set();
    }
    if (!start && !end && r.window) {
      const wr = windowRange(r.window);
      start = wr.start;
      end = wr.end;
    }
    if (start && end && end <= start) return new Set();

    const whereParts: any[] = [
      eq(metricsMetricPoints.entityKind, entityKind),
      eq(metricsMetricPoints.metricKey, metricKey),
      sql`${metricsMetricPoints.entityId} in (${sql.join(idList, sql`, `)})`,
    ];
    if (start) whereParts.push(gte(metricsMetricPoints.date, start));
    if (end) whereParts.push(lte(metricsMetricPoints.date, end));

    const agg: MetricAgg = (r.agg || 'sum') as MetricAgg;
    const op: Op = r.op;
    const threshold = asNumber(r.value);
    if (!threshold && threshold !== 0) return new Set();

    if (agg === 'last') {
      const rnExpr = sql<number>`row_number() over (partition by ${metricsMetricPoints.entityId} order by ${metricsMetricPoints.date} desc)`.as('rn');
      const base = db
        .select({
          entityId: metricsMetricPoints.entityId,
          value: metricsMetricPoints.value,
          rn: rnExpr,
        } as any)
        .from(metricsMetricPoints)
        .where(and(...whereParts))
        .as('mp');

      const latest = db
        .select({ entityId: (base as any).entityId, value: (base as any).value } as any)
        .from(base as any)
        .where(eq((base as any).rn, 1))
        .as('latest');

      const whereMatch = opSql(op, sql`${(latest as any).value}::float8`, threshold);
      const rows = await db.select({ entityId: (latest as any).entityId } as any).from(latest as any).where(whereMatch);
      return new Set(rows.map((row: any) => String(row.entityId)));
    }

    // NOTE:
    // For "sum" (and "count"), entities with zero points are treated as 0 for bucket evaluation.
    // This is important for bucket columns like "Revenue (30d) < $100" where "no data yet" should land in the lowest bucket.
    const treatMissingAsZero = agg === 'sum' || agg === 'count';

    const aggExpr =
      agg === 'sum'
        ? sql`sum(${metricsMetricPoints.value})`
        : agg === 'avg'
          ? sql`avg(${metricsMetricPoints.value})`
          : agg === 'min'
            ? sql`min(${metricsMetricPoints.value})`
            : agg === 'max'
              ? sql`max(${metricsMetricPoints.value})`
              : sql`count(*)`;

    const rows = await db
      .select({
        entityId: metricsMetricPoints.entityId,
        v: sql`${aggExpr}::float8`.as('v'),
      } as any)
      .from(metricsMetricPoints)
      .where(and(...whereParts))
      .groupBy(metricsMetricPoints.entityId);

    const byId = new Map<string, number>();
    for (const row of rows as any[]) {
      const id = String(row?.entityId ?? '').trim();
      const v = asNumber((row as any)?.v);
      if (!id) continue;
      if (v === null) continue;
      byId.set(id, v);
    }

    const matched = new Set<string>();
    for (const id of ids) {
      const v = byId.has(id) ? (byId.get(id) as number) : (treatMissingAsZero ? 0 : null);
      if (v === null) continue;
      if (opMatch(op, v, threshold)) matched.add(id);
    }
    return matched;
  }

  return new Set();
}

/**
 * POST /api/metrics/segments/table-buckets/evaluate
 *
 * Body:
 *  - tableId: string
 *  - columnKey: string
 *  - entityKind: string
 *  - entityIds: string[]
 *
 * Returns:
 *  - data: { values: Record<entityId, { bucketLabel: string; segmentKey: string } | null> }
 */
export async function POST(request: NextRequest) {
  const gate = requireUserOrService(request);
  if (!gate.ok) return gate.res;

  const body = (await request.json().catch(() => null)) as
    | { tableId?: unknown; columnKey?: unknown; entityKind?: unknown; entityIds?: unknown }
    | null;
  if (!body) return jsonError('Invalid JSON body', 400);

  const tableId = typeof body.tableId === 'string' ? body.tableId.trim() : '';
  const columnKey = typeof body.columnKey === 'string' ? body.columnKey.trim() : '';
  const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
  const idsRaw = Array.isArray(body.entityIds) ? body.entityIds : [];
  const entityIds = idsRaw.map((x) => String(x || '').trim()).filter(Boolean);

  if (!tableId) return jsonError('Missing tableId', 400);
  if (!columnKey) return jsonError('Missing columnKey', 400);
  if (!entityKind) return jsonError('Missing entityKind', 400);
  if (entityIds.length === 0) return NextResponse.json({ data: { values: {} } });
  if (entityIds.length > 500) return jsonError('Too many entityIds (max 500)', 400);

  const buckets = await loadBuckets({ tableId, columnKey, entityKind });
  const values: Record<string, { bucketLabel: string; segmentKey: string } | null> = {};
  for (const id of entityIds) values[id] = null;

  // First-match wins, ordered by bucket sortOrder.
  for (const b of buckets) {
    const matches = await matchingEntityIdsForSegment(b.segmentKey, entityKind, entityIds);
    for (const id of matches) {
      if (values[id] === null) values[id] = { bucketLabel: b.bucketLabel, segmentKey: b.segmentKey };
    }
  }

  return NextResponse.json({ data: { values } });
}


