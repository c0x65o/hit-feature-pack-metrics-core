/**
 * Computed metrics module.
 *
 * This module provides fallback support for metrics that are declared in the catalog
 * but not stored as points. Instead, they are computed on-the-fly from source tables.
 */
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
async function callSameOrigin(request, path, init) {
    const url = new URL(request.url);
    const target = path.startsWith('http://') || path.startsWith('https://') ? path : `${url.origin}${path}`;
    const headers = new Headers(init.headers || {});
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (auth)
        headers.set('Authorization', auth);
    const rawToken = request.headers.get('x-hit-token-raw') || request.headers.get('X-HIT-Token-Raw');
    if (rawToken)
        headers.set('X-HIT-Token-Raw', rawToken);
    const cookie = request.headers.get('cookie') || request.headers.get('Cookie');
    if (cookie)
        headers.set('Cookie', cookie);
    if (!headers.has('X-Frontend-Base-URL')) {
        const origin = request.headers.get('origin') || url.origin;
        if (origin)
            headers.set('X-Frontend-Base-URL', origin);
    }
    return fetch(target, { ...init, headers });
}
async function resolveTargetValue(args) {
    if (!args.request)
        return null;
    const res = await callSameOrigin(args.request, '/api/targets/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            definitionKey: args.definitionKey,
            entityKey: args.entityKey,
            entityId: args.entityId,
            periodStart: args.periodStart || null,
            periodEnd: args.periodEnd || null,
            periodType: args.periodType || null,
        }),
    });
    if (!res.ok)
        return null;
    const json = (await res.json().catch(() => ({})));
    const value = json?.assignment?.targetValue ?? null;
    if (value == null)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
async function latestMetricSum(args) {
    const whereParts = [eq(metricsMetricPoints.metricKey, args.metricKey)];
    if (args.start)
        whereParts.push(gte(metricsMetricPoints.date, new Date(args.start)));
    if (args.end)
        whereParts.push(lte(metricsMetricPoints.date, new Date(args.end)));
    if (args.entityKind)
        whereParts.push(eq(metricsMetricPoints.entityKind, args.entityKind));
    if (args.entityId)
        whereParts.push(eq(metricsMetricPoints.entityId, args.entityId));
    if (Array.isArray(args.entityIds) && args.entityIds.length > 0) {
        whereParts.push(inArray(metricsMetricPoints.entityId, args.entityIds));
    }
    if (args.dimensions) {
        for (const [k, v] of Object.entries(args.dimensions)) {
            if (v === null)
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} is null`);
            else
                whereParts.push(sql `${metricsMetricPoints.dimensions} ->> ${k} = ${String(v)}`);
        }
    }
    const where = and(...whereParts);
    const latestRows = await args.db
        .select({ maxDate: sql `max(${metricsMetricPoints.date})` })
        .from(metricsMetricPoints)
        .where(where);
    const maxDate = latestRows?.[0]?.maxDate || null;
    if (!maxDate)
        return null;
    const sumRows = await args.db
        .select({ total: sql `sum(${metricsMetricPoints.value})` })
        .from(metricsMetricPoints)
        .where(and(where, eq(metricsMetricPoints.date, maxDate)));
    const total = Number(sumRows?.[0]?.total || 0);
    return Number.isFinite(total) ? total : null;
}
export async function tryRunComputedMetricQuery(args) {
    const metricKey = String(args.body.metricKey || '');
    if (!metricKey)
        return null;
    if (metricKey !== 'fp.crm.goal_attainment_percent' && metricKey !== 'fp.crm.target_vs_actual_usd') {
        return null;
    }
    const params = args.body.params && typeof args.body.params === 'object' ? args.body.params : {};
    const definitionKey = String(params?.definitionKey || params?.targetDefinitionKey || 'crm.sales.revenue');
    const periodType = String(args.body.dimensions?.period_type || params?.periodType || '').trim() || null;
    const entityKey = String(params?.entityKey || 'org.user');
    const entityId = String(args.body.dimensions?.user_id || args.body.entityId || (Array.isArray(args.body.entityIds) ? args.body.entityIds[0] : '') || '') ||
        '__all__';
    const targetValue = await resolveTargetValue({
        request: args.request || null,
        definitionKey,
        entityKey,
        entityId,
        periodStart: args.body.start || null,
        periodEnd: args.body.end || null,
        periodType,
    });
    const actualMetricKey = String(params?.actualMetricKey || 'fp.crm.pipeline_won_value_usd');
    const actualValue = (await latestMetricSum({
        db: args.db,
        metricKey: actualMetricKey,
        start: args.body.start,
        end: args.body.end,
        entityKind: args.body.entityKind || 'crm',
        entityId: undefined,
        entityIds: undefined,
        dimensions: undefined,
    })) ?? 0;
    const safeTarget = targetValue || 0;
    const goalPercent = safeTarget > 0 ? (actualValue / safeTarget) * 100 : 0;
    if (metricKey === 'fp.crm.goal_attainment_percent') {
        return {
            ok: true,
            data: [
                {
                    value: goalPercent,
                    target_amount: safeTarget,
                    actual_amount: actualValue,
                    user_id: args.body.dimensions?.user_id ?? null,
                    period_type: periodType,
                },
            ],
            meta: {
                computed: true,
                targetDefinitionKey: definitionKey,
                actualMetricKey,
            },
        };
    }
    return {
        ok: true,
        data: [
            {
                value: actualValue,
                target_amount: safeTarget,
                actual_amount: actualValue,
                user_id: args.body.dimensions?.user_id ?? null,
            },
        ],
        meta: {
            computed: true,
            targetDefinitionKey: definitionKey,
            actualMetricKey,
        },
    };
}
/**
 * Try to run a computed metric drilldown query.
 * Returns null if the metric is not a computed metric or if computation is not supported.
 */
export async function tryRunComputedMetricDrilldown(args) {
    // Stub implementation: return null to indicate no computed metric support
    // This allows the code to fall back to the points query path
    return null;
}
