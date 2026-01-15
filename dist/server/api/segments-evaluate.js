import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints, metricsSegments } from '@/lib/feature-pack-schemas';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { authQuery } from '../lib/auth-db';
import { resolveMetricsCoreScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function allowSelfUserEvaluate(request, entityKind, entityId) {
    const auth = getAuthContext(request);
    if (!auth || auth.kind !== 'user')
        return false;
    if (entityKind !== 'user')
        return false;
    const target = String(entityId || '').trim().toLowerCase();
    if (!target)
        return false;
    const me = String(auth.user.email || auth.user.sub || '').trim().toLowerCase();
    if (!me)
        return false;
    return me === target;
}
function cmp(op, left, right) {
    if (op === '>=')
        return left >= right;
    if (op === '>')
        return left > right;
    if (op === '<=')
        return left <= right;
    if (op === '<')
        return left < right;
    if (op === '==')
        return left === right;
    return left !== right;
}
function asNumber(x) {
    const n = typeof x === 'number' ? x : Number(x);
    return Number.isFinite(n) ? n : null;
}
function windowRange(window) {
    const w = typeof window === 'string' ? window : null;
    if (!w || w === 'all_time')
        return { start: null, end: null };
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    if (w === 'last_7_days')
        return { start: new Date(now.getTime() - 7 * dayMs), end: now };
    if (w === 'last_30_days')
        return { start: new Date(now.getTime() - 30 * dayMs), end: now };
    if (w === 'last_90_days')
        return { start: new Date(now.getTime() - 90 * dayMs), end: now };
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
async function evaluateMetricThreshold(args) {
    const { entityKind, entityId, rule } = args;
    const metricKey = String(rule.metricKey || '').trim();
    if (!metricKey)
        return { ok: false, error: 'Missing rule.metricKey' };
    const agg = (rule.agg || 'sum');
    const op = rule.op;
    const threshold = asNumber(rule.value);
    if (!threshold && threshold !== 0)
        return { ok: false, error: 'Invalid rule.value' };
    let start = null;
    let end = null;
    if (rule.start) {
        start = new Date(rule.start);
        if (Number.isNaN(start.getTime()))
            return { ok: false, error: 'Invalid rule.start' };
    }
    if (rule.end) {
        end = new Date(rule.end);
        if (Number.isNaN(end.getTime()))
            return { ok: false, error: 'Invalid rule.end' };
    }
    if (!start && !end && rule.window) {
        const wr = windowRange(rule.window);
        start = wr.start;
        end = wr.end;
    }
    if (start && end && end <= start)
        return { ok: false, error: 'rule.end must be after rule.start' };
    const whereParts = [
        eq(metricsMetricPoints.entityKind, entityKind),
        eq(metricsMetricPoints.entityId, entityId),
        eq(metricsMetricPoints.metricKey, metricKey),
    ];
    if (start)
        whereParts.push(gte(metricsMetricPoints.date, start));
    if (end)
        whereParts.push(lte(metricsMetricPoints.date, end));
    const db = getDb();
    if (agg === 'last') {
        const rows = await db
            .select({ value: metricsMetricPoints.value })
            .from(metricsMetricPoints)
            .where(and(...whereParts))
            .orderBy(sql `${metricsMetricPoints.date} desc`)
            .limit(1);
        const v = rows.length ? asNumber(rows[0].value) : 0;
        const ok = cmp(op, v ?? 0, threshold);
        return { ok: true, matches: ok, value: v ?? 0 };
    }
    const aggExpr = agg === 'sum'
        ? sql `sum(${metricsMetricPoints.value})`
        : agg === 'avg'
            ? sql `avg(${metricsMetricPoints.value})`
            : agg === 'min'
                ? sql `min(${metricsMetricPoints.value})`
                : agg === 'max'
                    ? sql `max(${metricsMetricPoints.value})`
                    : sql `count(*)`;
    const rows = await db
        .select({ value: aggExpr.as('value') })
        .from(metricsMetricPoints)
        .where(and(...whereParts));
    const v = rows.length ? asNumber(rows[0].value) : 0;
    const ok = cmp(op, v ?? 0, threshold);
    return { ok: true, matches: ok, value: v ?? 0 };
}
async function evaluateEntityAttribute(args) {
    const { entityKind, entityId, rule } = args;
    if (entityKind !== 'user')
        return { ok: false, error: `entity_attribute only supports entityKind=user (got ${entityKind})` };
    const email = String(entityId || '').trim().toLowerCase();
    if (!email)
        return { ok: false, error: 'Missing entityId' };
    const rows = await authQuery('select role, email_verified, locked from hit_auth_users where email = $1 limit 1', [email]);
    if (!rows.length)
        return { ok: true, matches: false, value: null };
    const u = rows[0];
    const attr = String(rule.attribute || '').trim();
    const op = rule.op === '!=' ? '!=' : '==';
    const expected = rule.value;
    let actual = null;
    if (attr === 'role')
        actual = typeof u.role === 'string' ? u.role : String(u.role || '');
    else if (attr === 'email_verified')
        actual = Boolean(u.email_verified);
    else if (attr === 'locked')
        actual = Boolean(u.locked);
    else
        return { ok: false, error: `Unsupported attribute: ${attr}` };
    const matches = op === '==' ? actual === expected : actual !== expected;
    return { ok: true, matches, value: actual };
}
export async function POST(request) {
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const segmentKey = typeof body.segmentKey === 'string' ? body.segmentKey.trim() : '';
    const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
    if (!segmentKey)
        return jsonError('Missing segmentKey', 400);
    if (!entityKind)
        return jsonError('Missing entityKind', 400);
    if (!entityId)
        return jsonError('Missing entityId', 400);
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    // Resolve scope mode for read access
    const mode = await resolveMetricsCoreScopeMode(request, { verb: 'read', entity: 'segments' });
    // Apply scope-based filtering (explicit branching on none/own/ldd/any)
    if (mode === 'none') {
        // Allow non-admin users to evaluate membership for themselves only (used by Vault ACL).
        if (!allowSelfUserEvaluate(request, entityKind, entityId))
            return jsonError('Forbidden', 403);
    }
    else if (mode === 'own' || mode === 'ldd') {
        // Metrics-core doesn't have ownership or LDD fields, so deny access
        // Allow non-admin users to evaluate membership for themselves only (used by Vault ACL).
        if (!allowSelfUserEvaluate(request, entityKind, entityId))
            return jsonError('Forbidden', 403);
    }
    else if (mode !== 'any') {
        // Fallback: deny access
        // Allow non-admin users to evaluate membership for themselves only (used by Vault ACL).
        if (!allowSelfUserEvaluate(request, entityKind, entityId))
            return jsonError('Forbidden', 403);
    }
    const db = getDb();
    const segRows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, segmentKey)).limit(1);
    if (!segRows.length)
        return jsonError('Segment not found', 404);
    const seg = segRows[0];
    if (seg.entityKind !== entityKind)
        return jsonError(`Segment entityKind mismatch (segment=${seg.entityKind}, request=${entityKind})`, 400);
    if (seg.isActive === false)
        return NextResponse.json({ data: { matches: false, reason: 'inactive' } });
    const rule = (seg.rule && typeof seg.rule === 'object' ? seg.rule : null);
    if (!rule || typeof rule.kind !== 'string')
        return jsonError('Segment rule is invalid', 500);
    if (rule.kind === 'all_entities') {
        if (entityKind !== 'user')
            return jsonError(`all_entities only supports entityKind=user (got ${entityKind})`, 400);
        const email = String(entityId || '').trim().toLowerCase();
        if (!email)
            return NextResponse.json({ data: { matches: false } });
        const rows = await authQuery('select 1 as ok from hit_auth_users where lower(email) = $1 limit 1', [email]);
        return NextResponse.json({ data: { matches: rows.length > 0 } });
    }
    if (rule.kind === 'static_entity_ids') {
        const ids = Array.isArray(rule.entityIds) ? rule.entityIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
        return NextResponse.json({ data: { matches: ids.includes(entityId) } });
    }
    if (rule.kind === 'metric_threshold') {
        const out = await evaluateMetricThreshold({ entityKind, entityId, rule: rule });
        if (!out.ok)
            return jsonError(out.error, 400);
        return NextResponse.json({ data: { matches: out.matches, value: out.value } });
    }
    if (rule.kind === 'entity_attribute') {
        const out = await evaluateEntityAttribute({ entityKind, entityId, rule: rule });
        if (!out.ok)
            return jsonError(out.error, 400);
        return NextResponse.json({ data: { matches: out.matches, value: out.value } });
    }
    return jsonError(`Unsupported rule kind: ${rule.kind}`, 400);
}
