import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints, metricsSegments } from '@/lib/feature-pack-schemas';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireAdminOrService(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return { ok: false as const, res: jsonError('Unauthorized', 401) };
  if (auth.kind === 'service') return { ok: true as const };
  const roles = Array.isArray(auth.user.roles) ? auth.user.roles : [];
  if (!roles.includes('admin')) return { ok: false as const, res: jsonError('Forbidden', 403) };
  return { ok: true as const };
}

type MetricAgg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
type Op = '>=' | '>' | '<=' | '<' | '==' | '!=';

function cmp(op: Op, left: number, right: number): boolean {
  if (op === '>=') return left >= right;
  if (op === '>') return left > right;
  if (op === '<=') return left <= right;
  if (op === '<') return left < right;
  if (op === '==') return left === right;
  return left !== right;
}

function asNumber(x: unknown): number | null {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

type MetricThresholdRule = {
  kind: 'metric_threshold';
  metricKey: string;
  agg?: MetricAgg;
  start?: string;
  end?: string;
  op: Op;
  value: number;
};

type StaticIdsRule = {
  kind: 'static_entity_ids';
  entityIds: string[];
};

type SegmentRule = MetricThresholdRule | StaticIdsRule | { kind: string; [k: string]: unknown };

async function evaluateMetricThreshold(args: {
  entityKind: string;
  entityId: string;
  rule: MetricThresholdRule;
}) {
  const { entityKind, entityId, rule } = args;
  const metricKey = String(rule.metricKey || '').trim();
  if (!metricKey) return { ok: false as const, error: 'Missing rule.metricKey' };

  const agg: MetricAgg = (rule.agg || 'sum') as MetricAgg;
  const op: Op = rule.op;
  const threshold = asNumber(rule.value);
  if (!threshold && threshold !== 0) return { ok: false as const, error: 'Invalid rule.value' };

  let start: Date | null = null;
  let end: Date | null = null;
  if (rule.start) {
    start = new Date(rule.start);
    if (Number.isNaN(start.getTime())) return { ok: false as const, error: 'Invalid rule.start' };
  }
  if (rule.end) {
    end = new Date(rule.end);
    if (Number.isNaN(end.getTime())) return { ok: false as const, error: 'Invalid rule.end' };
  }
  if (start && end && end <= start) return { ok: false as const, error: 'rule.end must be after rule.start' };

  const whereParts: any[] = [
    eq(metricsMetricPoints.entityKind, entityKind),
    eq(metricsMetricPoints.entityId, entityId),
    eq(metricsMetricPoints.metricKey, metricKey),
  ];
  if (start) whereParts.push(gte(metricsMetricPoints.date, start));
  if (end) whereParts.push(lte(metricsMetricPoints.date, end));

  const db = getDb();

  if (agg === 'last') {
    const rows = await db
      .select({ value: metricsMetricPoints.value })
      .from(metricsMetricPoints)
      .where(and(...whereParts))
      .orderBy(sql`${metricsMetricPoints.date} desc`)
      .limit(1);
    const v = rows.length ? asNumber((rows[0] as any).value) : 0;
    const ok = cmp(op, v ?? 0, threshold);
    return { ok: true as const, matches: ok, value: v ?? 0 };
  }

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
    .select({ value: aggExpr.as('value') as any })
    .from(metricsMetricPoints)
    .where(and(...whereParts));

  const v = rows.length ? asNumber((rows[0] as any).value) : 0;
  const ok = cmp(op, v ?? 0, threshold);
  return { ok: true as const, matches: ok, value: v ?? 0 };
}

export async function POST(request: NextRequest) {
  const gate = requireAdminOrService(request);
  if (!gate.ok) return gate.res;

  const body = (await request.json().catch(() => null)) as
    | { segmentKey?: unknown; entityKind?: unknown; entityId?: unknown }
    | null;
  if (!body) return jsonError('Invalid JSON body', 400);

  const segmentKey = typeof body.segmentKey === 'string' ? body.segmentKey.trim() : '';
  const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
  if (!segmentKey) return jsonError('Missing segmentKey', 400);
  if (!entityKind) return jsonError('Missing entityKind', 400);
  if (!entityId) return jsonError('Missing entityId', 400);

  const db = getDb();
  const segRows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, segmentKey)).limit(1);
  if (!segRows.length) return jsonError('Segment not found', 404);
  const seg = segRows[0] as any;
  if (seg.entityKind !== entityKind) return jsonError(`Segment entityKind mismatch (segment=${seg.entityKind}, request=${entityKind})`, 400);
  if (seg.isActive === false) return NextResponse.json({ data: { matches: false, reason: 'inactive' } });

  const rule = (seg.rule && typeof seg.rule === 'object' ? seg.rule : null) as SegmentRule | null;
  if (!rule || typeof (rule as any).kind !== 'string') return jsonError('Segment rule is invalid', 500);

  if (rule.kind === 'static_entity_ids') {
    const ids = Array.isArray((rule as any).entityIds) ? (rule as any).entityIds.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
    return NextResponse.json({ data: { matches: ids.includes(entityId) } });
  }

  if (rule.kind === 'metric_threshold') {
    const out = await evaluateMetricThreshold({ entityKind, entityId, rule: rule as MetricThresholdRule });
    if (!out.ok) return jsonError(out.error, 400);
    return NextResponse.json({ data: { matches: out.matches, value: out.value } });
  }

  return jsonError(`Unsupported rule kind: ${(rule as any).kind}`, 400);
}


