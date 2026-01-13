import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';
// Minimal CRM table shapes (metrics-core must not depend on the CRM feature pack at build-time).
// Keep these small and stable: only add columns needed for computed queries/drilldowns.
const crmPipelineStages = pgTable('crm_pipeline_stages', {
    id: uuid('id'),
    code: varchar('code', { length: 50 }),
    name: varchar('name', { length: 100 }),
    order: numeric('order'),
    isClosedWon: boolean('is_closed_won'),
    isClosedLost: boolean('is_closed_lost'),
});
const crmOpportunityLikelihoodTypes = pgTable('crm_opportunity_likelihood_types', {
    id: uuid('id'),
    name: varchar('name', { length: 100 }),
});
const crmProspects = pgTable('crm_prospects', {
    id: uuid('id'),
    name: varchar('name', { length: 255 }),
    createdOnTimestamp: timestamp('created_on_timestamp', { withTimezone: true }),
});
const crmContacts = pgTable('crm_contacts', {
    id: uuid('id'),
    name: varchar('name', { length: 255 }),
    createdOnTimestamp: timestamp('created_on_timestamp', { withTimezone: true }),
});
const crmOpportunities = pgTable('crm_opportunities', {
    id: uuid('id'),
    name: varchar('name', { length: 255 }),
    amount: numeric('amount', { precision: 20, scale: 2 }),
    pipelineStage: uuid('pipeline_stage'),
    stageEnteredAt: timestamp('stage_entered_at', { withTimezone: true }),
    likelihoodTypeId: uuid('likelihood_type_id'),
    createdOnTimestamp: timestamp('created_on_timestamp', { withTimezone: true }),
    lastUpdatedOnTimestamp: timestamp('last_updated_on_timestamp', { withTimezone: true }),
});
const crmActivities = pgTable('crm_activities', {
    relatedOpportunityId: uuid('related_opportunity_id'),
    activityDate: timestamp('activity_date', { withTimezone: true }),
});
function asBool(v) {
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'number')
        return v !== 0;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes')
            return true;
        if (s === 'false' || s === '0' || s === 'no')
            return false;
    }
    return null;
}
function asNum(v) {
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
        const x = Number(v.trim());
        return Number.isFinite(x) ? x : null;
    }
    return null;
}
function isValidKey(k) {
    return typeof k === 'string' && /^[a-zA-Z0-9_]+$/.test(k);
}
function parseOptionalDate(label, raw) {
    if (raw == null)
        return null;
    const s = String(raw).trim();
    if (!s)
        return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        throw new Error(`Invalid ${label}`);
    return d;
}
function bucketExprFromTs(bucket, ts) {
    return sql `date_trunc(${bucket}, ${ts})`;
}
function resolveParamDefaultsFromCatalog(catalogEntry) {
    const out = {};
    const spec = catalogEntry?.params;
    if (!spec || typeof spec !== 'object')
        return out;
    for (const [k, v] of Object.entries(spec)) {
        if (!isValidKey(k))
            continue;
        if (v && typeof v === 'object' && 'default' in v)
            out[k] = v.default;
    }
    return out;
}
function resolveParams(body, catalogEntry) {
    const defaults = resolveParamDefaultsFromCatalog(catalogEntry);
    const raw = body.params && typeof body.params === 'object' ? body.params : {};
    return { ...defaults, ...raw };
}
function validateBucketAndWindow(body) {
    const bucket = body.bucket || 'day';
    const agg = body.agg || 'sum';
    if (!['none', 'hour', 'day', 'week', 'month'].includes(bucket))
        return { ok: false, error: `Invalid bucket: ${bucket}` };
    if (!['sum', 'avg', 'min', 'max', 'count', 'last'].includes(agg))
        return { ok: false, error: `Invalid agg: ${agg}` };
    let start = null;
    let end = null;
    try {
        if (bucket !== 'none') {
            if (!body.start || !body.end)
                return { ok: false, error: 'Missing start/end' };
            start = parseOptionalDate('start', body.start);
            end = parseOptionalDate('end', body.end);
            if (!start)
                return { ok: false, error: 'Invalid start' };
            if (!end)
                return { ok: false, error: 'Invalid end' };
            if (end <= start)
                return { ok: false, error: 'end must be after start' };
        }
        else {
            start = parseOptionalDate('start', body.start);
            end = parseOptionalDate('end', body.end);
            if (start && end && end <= start)
                return { ok: false, error: 'end must be after start' };
        }
    }
    catch (e) {
        return { ok: false, error: String(e?.message || 'Invalid date') };
    }
    return { ok: true, bucket, agg, start, end };
}
function coerceStageKey(k) {
    // Allow both snake_case (catalog) and camelCase (legacy API JSON) keys in filters/groupBy.
    if (k === 'stage_id' || k === 'stageId')
        return 'stage_id';
    if (k === 'stage_code' || k === 'stageCode')
        return 'stage_code';
    if (k === 'stage_name' || k === 'stageName')
        return 'stage_name';
    if (k === 'stage_closed_won' || k === 'stageClosedWon')
        return 'stage_closed_won';
    if (k === 'stage_closed_lost' || k === 'stageClosedLost')
        return 'stage_closed_lost';
    return null;
}
function coerceLikelihoodKey(k) {
    if (k === 'likelihood_type_id' || k === 'likelihoodTypeId')
        return 'likelihood_type_id';
    if (k === 'likelihood_name' || k === 'likelihoodName')
        return 'likelihood_name';
    return null;
}
function applyStageDimFilters(dimFilters, where) {
    if (!dimFilters)
        return { ok: true };
    for (const [rawK, v] of Object.entries(dimFilters)) {
        if (!isValidKey(rawK))
            return { ok: false, error: `Invalid dimensions filter key: ${rawK}` };
        const k = coerceStageKey(rawK);
        if (!k)
            continue; // allow other dimensions for other computed metrics
        if (k === 'stage_id') {
            where.push(v === null ? sql `${crmPipelineStages.id} is null` : sql `${crmPipelineStages.id} = ${String(v)}`);
            continue;
        }
        if (k === 'stage_code') {
            where.push(v === null ? sql `${crmPipelineStages.code} is null` : sql `${crmPipelineStages.code} = ${String(v)}`);
            continue;
        }
        if (k === 'stage_name') {
            where.push(v === null ? sql `${crmPipelineStages.name} is null` : sql `${crmPipelineStages.name} = ${String(v)}`);
            continue;
        }
        if (k === 'stage_closed_won') {
            const b = v === null ? null : asBool(v);
            if (b === null)
                return { ok: false, error: `Invalid boolean dimensions value for ${rawK}` };
            where.push(v === null ? sql `${crmPipelineStages.isClosedWon} is null` : sql `${crmPipelineStages.isClosedWon} = ${b}`);
            continue;
        }
        if (k === 'stage_closed_lost') {
            const b = v === null ? null : asBool(v);
            if (b === null)
                return { ok: false, error: `Invalid boolean dimensions value for ${rawK}` };
            where.push(v === null ? sql `${crmPipelineStages.isClosedLost} is null` : sql `${crmPipelineStages.isClosedLost} = ${b}`);
            continue;
        }
    }
    return { ok: true };
}
function applyLikelihoodDimFilters(dimFilters, where) {
    if (!dimFilters)
        return { ok: true };
    for (const [rawK, v] of Object.entries(dimFilters)) {
        if (!isValidKey(rawK))
            return { ok: false, error: `Invalid dimensions filter key: ${rawK}` };
        const k = coerceLikelihoodKey(rawK);
        if (!k)
            continue;
        if (k === 'likelihood_type_id') {
            where.push(v === null ? sql `${crmOpportunityLikelihoodTypes.id} is null` : sql `${crmOpportunityLikelihoodTypes.id} = ${String(v)}`);
            continue;
        }
        if (k === 'likelihood_name') {
            where.push(v === null ? sql `${crmOpportunityLikelihoodTypes.name} is null` : sql `${crmOpportunityLikelihoodTypes.name} = ${String(v)}`);
            continue;
        }
    }
    return { ok: true };
}
/**
 * Computed metrics:
 * - Used when a metric key is declared in the catalog but we don't have (or don't want) stored points.
 * - Must return the SAME shape as /api/metrics/query: rows with { bucket?, value, ...groupByKeys }.
 */
export async function tryRunComputedMetricQuery(args) {
    const { db, body, catalogEntry } = args;
    const metricKey = String(body.metricKey || '').trim();
    if (!metricKey)
        return null;
    // Only handle CRM-owned metrics for now.
    const ownerId = String(catalogEntry?.owner?.id || '').trim();
    if (ownerId !== 'crm')
        return null;
    if (body.groupByEntityId)
        return { ok: false, error: 'CRM computed metrics do not support groupByEntityId' };
    if (body.entityId || (Array.isArray(body.entityIds) && body.entityIds.length > 0)) {
        return { ok: false, error: 'CRM computed metrics do not support entityId/entityIds filtering' };
    }
    const windowed = validateBucketAndWindow(body);
    if (!windowed.ok)
        return { ok: false, error: windowed.error };
    const { bucket, agg, start, end } = windowed;
    const groupBy = Array.isArray(body.groupBy) ? body.groupBy : [];
    for (const k of groupBy) {
        if (!isValidKey(k))
            return { ok: false, error: `Invalid groupBy key: ${String(k)}` };
    }
    const dimFilters = body.dimensions && typeof body.dimensions === 'object' ? body.dimensions : null;
    const params = resolveParams(body, catalogEntry);
    // ────────────────────────────────────────────────────────────────────────────
    // 1) Stage-entered movement metrics (timeseries; inferred from stage_entered_at)
    // ────────────────────────────────────────────────────────────────────────────
    const isStageEnteredCount = metricKey === 'fp.crm.opportunities_stage_entered_count';
    const isStageEnteredAmount = metricKey === 'fp.crm.opportunities_stage_entered_amount_usd';
    if (isStageEnteredCount || isStageEnteredAmount) {
        if (agg === 'last')
            return { ok: false, error: 'agg=last is not supported for CRM computed stage-entered metrics' };
        const where = [sql `${crmOpportunities.stageEnteredAt} is not null`];
        if (start)
            where.push(sql `${crmOpportunities.stageEnteredAt} >= ${start}`);
        if (end)
            where.push(sql `${crmOpportunities.stageEnteredAt} <= ${end}`);
        const stageFilterRes = applyStageDimFilters(dimFilters, where);
        if (!stageFilterRes.ok)
            return { ok: false, error: stageFilterRes.error };
        const select = {};
        const groupExprs = [];
        const orderExprs = [];
        if (bucket !== 'none') {
            const be = bucketExprFromTs(bucket, crmOpportunities.stageEnteredAt).as('bucket');
            select.bucket = be;
            groupExprs.push(be);
            orderExprs.push(sql `bucket`);
        }
        // Resolve groupBy keys from stage columns (support both casing styles).
        for (const rawK of groupBy) {
            const k = coerceStageKey(rawK) || rawK;
            if (k === 'stage_id') {
                select.stage_id = crmPipelineStages.id;
                groupExprs.push(crmPipelineStages.id);
                orderExprs.push(crmPipelineStages.id);
                continue;
            }
            if (k === 'stage_code') {
                select.stage_code = crmPipelineStages.code;
                groupExprs.push(crmPipelineStages.code);
                orderExprs.push(crmPipelineStages.code);
                continue;
            }
            if (k === 'stage_name') {
                select.stage_name = crmPipelineStages.name;
                groupExprs.push(crmPipelineStages.name);
                orderExprs.push(crmPipelineStages.name);
                continue;
            }
            if (k === 'stage_closed_won') {
                select.stage_closed_won = crmPipelineStages.isClosedWon;
                groupExprs.push(crmPipelineStages.isClosedWon);
                orderExprs.push(crmPipelineStages.isClosedWon);
                continue;
            }
            if (k === 'stage_closed_lost') {
                select.stage_closed_lost = crmPipelineStages.isClosedLost;
                groupExprs.push(crmPipelineStages.isClosedLost);
                orderExprs.push(crmPipelineStages.isClosedLost);
                continue;
            }
            return { ok: false, error: `Unsupported groupBy key for CRM stage-entered metric: ${rawK}` };
        }
        select.value = isStageEnteredCount
            ? sql `count(*)::float8`.as('value')
            : sql `coalesce(sum(${crmOpportunities.amount}), 0)::float8`.as('value');
        const rows = await db
            .select(select)
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(where.length ? sql `${sql.join(where, sql ` AND `)}` : undefined)
            .groupBy(...groupExprs)
            .orderBy(...orderExprs);
        return {
            ok: true,
            data: rows,
            meta: {
                metricKey,
                start: start ? start.toISOString() : null,
                end: end ? end.toISOString() : null,
                bucket,
                agg,
                groupBy,
                groupByEntityId: false,
                computed: true,
                computedOwner: ownerId,
                params,
            },
        };
    }
    // ────────────────────────────────────────────────────────────────────────────
    // 2) Snapshot totals (counts + pipeline totals)
    // ────────────────────────────────────────────────────────────────────────────
    const snapshotKeys = new Set([
        'fp.crm.prospects_count',
        'fp.crm.contacts_count',
        'fp.crm.opportunities_count',
        'fp.crm.pipeline_total_value_usd',
        'fp.crm.pipeline_won_value_usd',
    ]);
    if (snapshotKeys.has(metricKey)) {
        if (bucket !== 'none')
            return { ok: false, error: 'This CRM snapshot metric only supports bucket=none' };
        if (agg === 'last')
            return { ok: false, error: 'agg=last is not supported for this CRM snapshot metric (use agg=sum/count)' };
        if (groupBy.length)
            return { ok: false, error: 'groupBy is not supported for this CRM snapshot metric' };
        if (metricKey === 'fp.crm.prospects_count') {
            const [{ value }] = await db.select({ value: sql `count(*)::float8`.as('value') }).from(crmProspects);
            return { ok: true, data: [{ value: Number(value || 0) }], meta: { metricKey, start: null, end: null, bucket, agg, groupBy: [], groupByEntityId: false, computed: true, computedOwner: ownerId, params } };
        }
        if (metricKey === 'fp.crm.contacts_count') {
            const [{ value }] = await db.select({ value: sql `count(*)::float8`.as('value') }).from(crmContacts);
            return { ok: true, data: [{ value: Number(value || 0) }], meta: { metricKey, start: null, end: null, bucket, agg, groupBy: [], groupByEntityId: false, computed: true, computedOwner: ownerId, params } };
        }
        if (metricKey === 'fp.crm.opportunities_count') {
            const [{ value }] = await db.select({ value: sql `count(*)::float8`.as('value') }).from(crmOpportunities);
            return { ok: true, data: [{ value: Number(value || 0) }], meta: { metricKey, start: null, end: null, bucket, agg, groupBy: [], groupByEntityId: false, computed: true, computedOwner: ownerId, params } };
        }
        if (metricKey === 'fp.crm.pipeline_total_value_usd') {
            const [{ value }] = await db
                .select({ value: sql `coalesce(sum(${crmOpportunities.amount}), 0)::float8`.as('value') })
                .from(crmOpportunities);
            return { ok: true, data: [{ value: Number(value || 0) }], meta: { metricKey, start: null, end: null, bucket, agg, groupBy: [], groupByEntityId: false, computed: true, computedOwner: ownerId, params } };
        }
        if (metricKey === 'fp.crm.pipeline_won_value_usd') {
            const where = [eq(crmPipelineStages.isClosedWon, true)];
            const [{ value }] = await db
                .select({ value: sql `coalesce(sum(${crmOpportunities.amount}), 0)::float8`.as('value') })
                .from(crmOpportunities)
                .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
                .where(and(...where));
            return { ok: true, data: [{ value: Number(value || 0) }], meta: { metricKey, start: null, end: null, bucket, agg, groupBy: [], groupByEntityId: false, computed: true, computedOwner: ownerId, params } };
        }
    }
    // ────────────────────────────────────────────────────────────────────────────
    // 3) Pipeline distribution by stage (current pipeline stage)
    // ────────────────────────────────────────────────────────────────────────────
    const isPipelineStageCount = metricKey === 'fp.crm.opportunities_by_stage_count';
    const isPipelineStageValue = metricKey === 'fp.crm.opportunities_by_stage_value_usd';
    if (isPipelineStageCount || isPipelineStageValue) {
        if (bucket !== 'none')
            return { ok: false, error: 'Pipeline-by-stage metrics only support bucket=none' };
        if (agg === 'last')
            return { ok: false, error: 'agg=last is not supported for CRM pipeline-by-stage metrics' };
        const where = [];
        const stageFilterRes = applyStageDimFilters(dimFilters, where);
        if (!stageFilterRes.ok)
            return { ok: false, error: stageFilterRes.error };
        const select = {};
        const groupExprs = [];
        const orderExprs = [];
        for (const rawK of groupBy) {
            const k = coerceStageKey(rawK) || rawK;
            if (k === 'stage_id') {
                select.stage_id = crmPipelineStages.id;
                groupExprs.push(crmPipelineStages.id);
                orderExprs.push(crmPipelineStages.id);
                continue;
            }
            if (k === 'stage_name') {
                select.stage_name = crmPipelineStages.name;
                groupExprs.push(crmPipelineStages.name);
                orderExprs.push(crmPipelineStages.name);
                continue;
            }
            if (k === 'stage_code') {
                select.stage_code = crmPipelineStages.code;
                groupExprs.push(crmPipelineStages.code);
                orderExprs.push(crmPipelineStages.code);
                continue;
            }
            if (k === 'stage_closed_won') {
                select.stage_closed_won = crmPipelineStages.isClosedWon;
                groupExprs.push(crmPipelineStages.isClosedWon);
                orderExprs.push(crmPipelineStages.isClosedWon);
                continue;
            }
            if (k === 'stage_closed_lost') {
                select.stage_closed_lost = crmPipelineStages.isClosedLost;
                groupExprs.push(crmPipelineStages.isClosedLost);
                orderExprs.push(crmPipelineStages.isClosedLost);
                continue;
            }
            return { ok: false, error: `Unsupported groupBy key for CRM pipeline-by-stage metric: ${rawK}` };
        }
        select.value = isPipelineStageCount
            ? sql `count(*)::float8`.as('value')
            : sql `coalesce(sum(${crmOpportunities.amount}), 0)::float8`.as('value');
        const rows = await db
            .select(select)
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(where.length ? sql `${sql.join(where, sql ` AND `)}` : undefined)
            .groupBy(...groupExprs)
            .orderBy(...orderExprs);
        return {
            ok: true,
            data: rows,
            meta: {
                metricKey,
                start: null,
                end: null,
                bucket,
                agg,
                groupBy,
                groupByEntityId: false,
                computed: true,
                computedOwner: ownerId,
                params,
            },
        };
    }
    // ────────────────────────────────────────────────────────────────────────────
    // 4) Opportunity distribution by likelihood (current likelihood)
    // ────────────────────────────────────────────────────────────────────────────
    const isLikelihoodCount = metricKey === 'fp.crm.opportunities_by_likelihood_count';
    const isLikelihoodValue = metricKey === 'fp.crm.opportunities_by_likelihood_value_usd';
    if (isLikelihoodCount || isLikelihoodValue) {
        if (bucket !== 'none')
            return { ok: false, error: 'Likelihood distribution metrics only support bucket=none' };
        if (agg === 'last')
            return { ok: false, error: 'agg=last is not supported for CRM likelihood metrics' };
        const where = [];
        const likeFilterRes = applyLikelihoodDimFilters(dimFilters, where);
        if (!likeFilterRes.ok)
            return { ok: false, error: likeFilterRes.error };
        const select = {};
        const groupExprs = [];
        const orderExprs = [];
        for (const rawK of groupBy) {
            const k = coerceLikelihoodKey(rawK) || rawK;
            if (k === 'likelihood_type_id') {
                select.likelihood_type_id = crmOpportunityLikelihoodTypes.id;
                groupExprs.push(crmOpportunityLikelihoodTypes.id);
                orderExprs.push(crmOpportunityLikelihoodTypes.id);
                continue;
            }
            if (k === 'likelihood_name') {
                select.likelihood_name = crmOpportunityLikelihoodTypes.name;
                groupExprs.push(crmOpportunityLikelihoodTypes.name);
                orderExprs.push(crmOpportunityLikelihoodTypes.name);
                continue;
            }
            return { ok: false, error: `Unsupported groupBy key for CRM likelihood metric: ${rawK}` };
        }
        select.value = isLikelihoodCount
            ? sql `count(*)::float8`.as('value')
            : sql `coalesce(sum(${crmOpportunities.amount}), 0)::float8`.as('value');
        const rows = await db
            .select(select)
            .from(crmOpportunities)
            .leftJoin(crmOpportunityLikelihoodTypes, sql `${crmOpportunities.likelihoodTypeId} = ${crmOpportunityLikelihoodTypes.id}`)
            .where(where.length ? sql `${sql.join(where, sql ` AND `)}` : undefined)
            .groupBy(...groupExprs)
            .orderBy(...orderExprs);
        return {
            ok: true,
            data: rows,
            meta: {
                metricKey,
                start: null,
                end: null,
                bucket,
                agg,
                groupBy,
                groupByEntityId: false,
                computed: true,
                computedOwner: ownerId,
                params,
            },
        };
    }
    // ────────────────────────────────────────────────────────────────────────────
    // 5) Stalled opportunities (param: days=7 by default)
    // ────────────────────────────────────────────────────────────────────────────
    const isStalledCount = metricKey === 'fp.crm.stalled_opportunities_count';
    const isStalledValue = metricKey === 'fp.crm.stalled_opportunities_value_usd';
    if (isStalledCount || isStalledValue) {
        if (bucket !== 'none')
            return { ok: false, error: 'Stalled opportunity snapshot metrics only support bucket=none' };
        if (agg === 'last')
            return { ok: false, error: 'agg=last is not supported for stalled opportunity metrics' };
        if (groupBy.length)
            return { ok: false, error: 'groupBy is not supported for stalled opportunity totals (use drilldown instead)' };
        const daysRaw = params.days;
        const daysN = asNum(daysRaw);
        const days = Math.max(1, Math.min(365, Math.floor(daysN ?? 7)));
        const now = new Date();
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        // Compute last activity per opportunity via grouped subquery.
        const lastAct = db
            .select({
            opportunityId: crmActivities.relatedOpportunityId,
            lastActivityAt: sql `max(${crmActivities.activityDate})`.as('lastActivityAt'),
        })
            .from(crmActivities)
            .where(sql `${crmActivities.relatedOpportunityId} is not null`)
            .groupBy(crmActivities.relatedOpportunityId)
            .as('last_act');
        const stalledWhere = and(eq(crmPipelineStages.isClosedWon, false), eq(crmPipelineStages.isClosedLost, false), or(lt(lastAct.lastActivityAt, cutoff), and(isNull(lastAct.lastActivityAt), lt(crmOpportunities.createdOnTimestamp, cutoff))));
        const stageFilterRes = applyStageDimFilters(dimFilters, []); // stage filters apply via join columns below; handled by adding to where clause
        if (!stageFilterRes.ok)
            return { ok: false, error: stageFilterRes.error };
        // Apply stage filters by turning them into SQL on crmPipelineStages.*
        const extraWhere = [];
        const stageDimRes = applyStageDimFilters(dimFilters, extraWhere);
        if (!stageDimRes.ok)
            return { ok: false, error: stageDimRes.error };
        const whereAll = extraWhere.length ? and(stalledWhere, sql `${sql.join(extraWhere, sql ` AND `)}`) : stalledWhere;
        if (isStalledCount) {
            const [{ value }] = await db
                .select({ value: sql `count(*)::float8`.as('value') })
                .from(crmOpportunities)
                .innerJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
                .leftJoin(lastAct, sql `${lastAct.opportunityId} = ${crmOpportunities.id}`)
                .where(whereAll);
            return { ok: true, data: [{ value: Number(value || 0) }], meta: { metricKey, start: null, end: null, bucket, agg, groupBy: [], groupByEntityId: false, computed: true, computedOwner: ownerId, params: { ...params, days } } };
        }
        const [{ value }] = await db
            .select({ value: sql `coalesce(sum(${crmOpportunities.amount}), 0)::float8`.as('value') })
            .from(crmOpportunities)
            .innerJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .leftJoin(lastAct, sql `${lastAct.opportunityId} = ${crmOpportunities.id}`)
            .where(whereAll);
        return { ok: true, data: [{ value: Number(value || 0) }], meta: { metricKey, start: null, end: null, bucket, agg, groupBy: [], groupByEntityId: false, computed: true, computedOwner: ownerId, params: { ...params, days } } };
    }
    return null;
}
/**
 * Computed drilldown:
 * - Used by /api/metrics/drilldown when the metric has no stored points.
 * - Returns "point-like" rows so dashboard drilldown stays functional.
 */
export async function tryRunComputedMetricDrilldown(args) {
    const { db, pointFilter, page, pageSize, catalogEntry } = args;
    const metricKey = String(pointFilter.metricKey || '').trim();
    if (!metricKey)
        return null;
    const ownerId = String(catalogEntry?.owner?.id || '').trim();
    if (ownerId !== 'crm')
        return null;
    const params = resolveParams(pointFilter, catalogEntry);
    const dimFilters = pointFilter.dimensions && typeof pointFilter.dimensions === 'object' ? pointFilter.dimensions : null;
    const offset = (page - 1) * pageSize;
    // Snapshot counts: list entities
    if (metricKey === 'fp.crm.prospects_count') {
        const [{ total }] = await db.select({ total: sql `count(*)::int`.as('total') }).from(crmProspects);
        const rows = await db
            .select({ id: crmProspects.id, name: crmProspects.name, createdOnTimestamp: crmProspects.createdOnTimestamp })
            .from(crmProspects)
            .orderBy(desc(crmProspects.createdOnTimestamp))
            .limit(pageSize)
            .offset(offset);
        const points = rows.map((r) => ({
            id: `cmp_${metricKey}_${String(r.id)}`,
            metricKey,
            entityKind: 'crm',
            entityId: String(r.id || ''),
            dataSourceId: 'crm',
            date: r.createdOnTimestamp ? new Date(r.createdOnTimestamp).toISOString() : '',
            value: 1,
            dimensions: { name: r.name || '' },
        }));
        return { ok: true, points, pagination: { page, pageSize, total: Number(total || 0) }, meta: { metricKey, computed: true, computedOwner: ownerId, params } };
    }
    if (metricKey === 'fp.crm.contacts_count') {
        const [{ total }] = await db.select({ total: sql `count(*)::int`.as('total') }).from(crmContacts);
        const rows = await db
            .select({ id: crmContacts.id, name: crmContacts.name, createdOnTimestamp: crmContacts.createdOnTimestamp })
            .from(crmContacts)
            .orderBy(desc(crmContacts.createdOnTimestamp))
            .limit(pageSize)
            .offset(offset);
        const points = rows.map((r) => ({
            id: `cmp_${metricKey}_${String(r.id)}`,
            metricKey,
            entityKind: 'crm',
            entityId: String(r.id || ''),
            dataSourceId: 'crm',
            date: r.createdOnTimestamp ? new Date(r.createdOnTimestamp).toISOString() : '',
            value: 1,
            dimensions: { name: r.name || '' },
        }));
        return { ok: true, points, pagination: { page, pageSize, total: Number(total || 0) }, meta: { metricKey, computed: true, computedOwner: ownerId, params } };
    }
    if (metricKey === 'fp.crm.opportunities_count' || metricKey === 'fp.crm.pipeline_total_value_usd' || metricKey === 'fp.crm.pipeline_won_value_usd') {
        const where = [];
        if (metricKey === 'fp.crm.pipeline_won_value_usd') {
            where.push(eq(crmPipelineStages.isClosedWon, true));
        }
        const whereSql = where.length ? and(...where) : undefined;
        const [{ total }] = await db
            .select({ total: sql `count(*)::int`.as('total') })
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(whereSql);
        const rows = await db
            .select({
            id: crmOpportunities.id,
            name: crmOpportunities.name,
            amount: crmOpportunities.amount,
            stageEnteredAt: crmOpportunities.stageEnteredAt,
            stageId: crmPipelineStages.id,
            stageName: crmPipelineStages.name,
            stageCode: crmPipelineStages.code,
            stageClosedWon: crmPipelineStages.isClosedWon,
            stageClosedLost: crmPipelineStages.isClosedLost,
        })
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(whereSql)
            .orderBy(desc(crmOpportunities.lastUpdatedOnTimestamp))
            .limit(pageSize)
            .offset(offset);
        const points = rows.map((r) => ({
            id: `cmp_${metricKey}_${String(r.id)}`,
            metricKey,
            entityKind: 'crm',
            entityId: String(r.id || ''),
            dataSourceId: 'crm',
            date: r.stageEnteredAt ? new Date(r.stageEnteredAt).toISOString() : '',
            value: metricKey.endsWith('_usd') ? Number(r.amount ?? 0) : 1,
            dimensions: {
                name: r.name || '',
                amount: Number(r.amount ?? 0),
                stage_id: r.stageId ? String(r.stageId) : null,
                stage_name: r.stageName || null,
                stage_code: r.stageCode || null,
                stage_closed_won: r.stageClosedWon ?? null,
                stage_closed_lost: r.stageClosedLost ?? null,
            },
        }));
        return { ok: true, points, pagination: { page, pageSize, total: Number(total || 0) }, meta: { metricKey, computed: true, computedOwner: ownerId, params } };
    }
    // Distribution metrics: list opportunities matching the slice filter.
    const stageFilterRes = applyStageDimFilters(dimFilters, []);
    if (!stageFilterRes.ok)
        return { ok: false, error: stageFilterRes.error };
    const likeFilterRes = applyLikelihoodDimFilters(dimFilters, []);
    if (!likeFilterRes.ok)
        return { ok: false, error: likeFilterRes.error };
    if (metricKey === 'fp.crm.opportunities_by_stage_count' || metricKey === 'fp.crm.opportunities_by_stage_value_usd') {
        const where = [];
        const stageRes = applyStageDimFilters(dimFilters, where);
        if (!stageRes.ok)
            return { ok: false, error: stageRes.error };
        const whereSql = where.length ? sql `${sql.join(where, sql ` AND `)}` : undefined;
        const [{ total }] = await db
            .select({ total: sql `count(*)::int`.as('total') })
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(whereSql);
        const rows = await db
            .select({
            id: crmOpportunities.id,
            name: crmOpportunities.name,
            amount: crmOpportunities.amount,
            stageEnteredAt: crmOpportunities.stageEnteredAt,
            stageId: crmPipelineStages.id,
            stageName: crmPipelineStages.name,
            stageCode: crmPipelineStages.code,
            stageClosedWon: crmPipelineStages.isClosedWon,
            stageClosedLost: crmPipelineStages.isClosedLost,
        })
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(whereSql)
            .orderBy(desc(crmOpportunities.lastUpdatedOnTimestamp))
            .limit(pageSize)
            .offset(offset);
        const points = rows.map((r) => ({
            id: `cmp_${metricKey}_${String(r.id)}`,
            metricKey,
            entityKind: 'crm',
            entityId: String(r.id || ''),
            dataSourceId: 'crm',
            date: r.stageEnteredAt ? new Date(r.stageEnteredAt).toISOString() : '',
            value: metricKey.endsWith('_usd') ? Number(r.amount ?? 0) : 1,
            dimensions: {
                name: r.name || '',
                amount: Number(r.amount ?? 0),
                stage_id: r.stageId ? String(r.stageId) : null,
                stage_name: r.stageName || null,
                stage_code: r.stageCode || null,
                stage_closed_won: r.stageClosedWon ?? null,
                stage_closed_lost: r.stageClosedLost ?? null,
            },
        }));
        return { ok: true, points, pagination: { page, pageSize, total: Number(total || 0) }, meta: { metricKey, computed: true, computedOwner: ownerId, params } };
    }
    if (metricKey === 'fp.crm.opportunities_by_likelihood_count' || metricKey === 'fp.crm.opportunities_by_likelihood_value_usd') {
        const where = [];
        const likeRes = applyLikelihoodDimFilters(dimFilters, where);
        if (!likeRes.ok)
            return { ok: false, error: likeRes.error };
        const whereSql = where.length ? sql `${sql.join(where, sql ` AND `)}` : undefined;
        const [{ total }] = await db
            .select({ total: sql `count(*)::int`.as('total') })
            .from(crmOpportunities)
            .leftJoin(crmOpportunityLikelihoodTypes, sql `${crmOpportunities.likelihoodTypeId} = ${crmOpportunityLikelihoodTypes.id}`)
            .where(whereSql);
        const rows = await db
            .select({
            id: crmOpportunities.id,
            name: crmOpportunities.name,
            amount: crmOpportunities.amount,
            lastUpdatedOnTimestamp: crmOpportunities.lastUpdatedOnTimestamp,
            likelihoodTypeId: crmOpportunityLikelihoodTypes.id,
            likelihoodName: crmOpportunityLikelihoodTypes.name,
        })
            .from(crmOpportunities)
            .leftJoin(crmOpportunityLikelihoodTypes, sql `${crmOpportunities.likelihoodTypeId} = ${crmOpportunityLikelihoodTypes.id}`)
            .where(whereSql)
            .orderBy(desc(crmOpportunities.lastUpdatedOnTimestamp))
            .limit(pageSize)
            .offset(offset);
        const points = rows.map((r) => ({
            id: `cmp_${metricKey}_${String(r.id)}`,
            metricKey,
            entityKind: 'crm',
            entityId: String(r.id || ''),
            dataSourceId: 'crm',
            date: r.lastUpdatedOnTimestamp ? new Date(r.lastUpdatedOnTimestamp).toISOString() : '',
            value: metricKey.endsWith('_usd') ? Number(r.amount ?? 0) : 1,
            dimensions: {
                name: r.name || '',
                amount: Number(r.amount ?? 0),
                likelihood_type_id: r.likelihoodTypeId ? String(r.likelihoodTypeId) : null,
                likelihood_name: r.likelihoodName || null,
            },
        }));
        return { ok: true, points, pagination: { page, pageSize, total: Number(total || 0) }, meta: { metricKey, computed: true, computedOwner: ownerId, params } };
    }
    if (metricKey === 'fp.crm.stalled_opportunities_count' || metricKey === 'fp.crm.stalled_opportunities_value_usd') {
        const daysRaw = params.days;
        const daysN = asNum(daysRaw);
        const days = Math.max(1, Math.min(365, Math.floor(daysN ?? 7)));
        const now = new Date();
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const lastAct = db
            .select({
            opportunityId: crmActivities.relatedOpportunityId,
            lastActivityAt: sql `max(${crmActivities.activityDate})`.as('lastActivityAt'),
        })
            .from(crmActivities)
            .where(sql `${crmActivities.relatedOpportunityId} is not null`)
            .groupBy(crmActivities.relatedOpportunityId)
            .as('last_act');
        const stalledWhere = and(eq(crmPipelineStages.isClosedWon, false), eq(crmPipelineStages.isClosedLost, false), or(lt(lastAct.lastActivityAt, cutoff), and(isNull(lastAct.lastActivityAt), lt(crmOpportunities.createdOnTimestamp, cutoff))));
        const extraWhere = [];
        const stageRes = applyStageDimFilters(dimFilters, extraWhere);
        if (!stageRes.ok)
            return { ok: false, error: stageRes.error };
        const whereAll = extraWhere.length ? and(stalledWhere, sql `${sql.join(extraWhere, sql ` AND `)}`) : stalledWhere;
        const [{ total }] = await db
            .select({ total: sql `count(*)::int`.as('total') })
            .from(crmOpportunities)
            .innerJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .leftJoin(lastAct, sql `${lastAct.opportunityId} = ${crmOpportunities.id}`)
            .where(whereAll);
        const rows = await db
            .select({
            id: crmOpportunities.id,
            name: crmOpportunities.name,
            amount: crmOpportunities.amount,
            createdOnTimestamp: crmOpportunities.createdOnTimestamp,
            stageEnteredAt: crmOpportunities.stageEnteredAt,
            stageId: crmPipelineStages.id,
            stageName: crmPipelineStages.name,
            stageCode: crmPipelineStages.code,
            lastActivityAt: lastAct.lastActivityAt,
            daysSinceLastActivity: sql `
          floor(
            extract(epoch from (${sql `now()`} - coalesce(${lastAct.lastActivityAt}, ${crmOpportunities.createdOnTimestamp})))
            / 86400
          )::int
        `.as('daysSinceLastActivity'),
        })
            .from(crmOpportunities)
            .innerJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .leftJoin(lastAct, sql `${lastAct.opportunityId} = ${crmOpportunities.id}`)
            .where(whereAll)
            .orderBy(asc(crmPipelineStages.order), desc(lastAct.lastActivityAt), desc(crmOpportunities.createdOnTimestamp))
            .limit(pageSize)
            .offset(offset);
        const points = rows.map((r) => ({
            id: `cmp_${metricKey}_${String(r.id)}`,
            metricKey,
            entityKind: 'crm',
            entityId: String(r.id || ''),
            dataSourceId: 'crm',
            date: r.lastActivityAt ? new Date(r.lastActivityAt).toISOString() : (r.createdOnTimestamp ? new Date(r.createdOnTimestamp).toISOString() : ''),
            value: metricKey.endsWith('_usd') ? Number(r.amount ?? 0) : 1,
            dimensions: {
                name: r.name || '',
                amount: Number(r.amount ?? 0),
                stage_id: r.stageId ? String(r.stageId) : null,
                stage_name: r.stageName || null,
                stage_code: r.stageCode || null,
                days: days,
                daysSinceLastActivity: Number(r.daysSinceLastActivity ?? 0),
                lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt).toISOString() : null,
                createdOnTimestamp: r.createdOnTimestamp ? new Date(r.createdOnTimestamp).toISOString() : null,
            },
        }));
        return { ok: true, points, pagination: { page, pageSize, total: Number(total || 0) }, meta: { metricKey, computed: true, computedOwner: ownerId, params: { ...params, days } } };
    }
    // Stage-entered drilldown: interpret filters over stage_entered_at window + stage dims.
    if (metricKey === 'fp.crm.opportunities_stage_entered_count' || metricKey === 'fp.crm.opportunities_stage_entered_amount_usd') {
        const start = parseOptionalDate('start', pointFilter.start);
        const end = parseOptionalDate('end', pointFilter.end);
        if (!start || !end)
            return { ok: false, error: 'Missing start/end for stage-entered drilldown' };
        if (end <= start)
            return { ok: false, error: 'end must be after start' };
        const where = [sql `${crmOpportunities.stageEnteredAt} is not null`, sql `${crmOpportunities.stageEnteredAt} >= ${start}`, sql `${crmOpportunities.stageEnteredAt} <= ${end}`];
        const stageRes = applyStageDimFilters(dimFilters, where);
        if (!stageRes.ok)
            return { ok: false, error: stageRes.error };
        const whereSql = sql `${sql.join(where, sql ` AND `)}`;
        const [{ total }] = await db
            .select({ total: sql `count(*)::int`.as('total') })
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(whereSql);
        const rows = await db
            .select({
            id: crmOpportunities.id,
            name: crmOpportunities.name,
            amount: crmOpportunities.amount,
            stageEnteredAt: crmOpportunities.stageEnteredAt,
            stageId: crmPipelineStages.id,
            stageName: crmPipelineStages.name,
            stageCode: crmPipelineStages.code,
        })
            .from(crmOpportunities)
            .leftJoin(crmPipelineStages, sql `${crmOpportunities.pipelineStage} = ${crmPipelineStages.id}`)
            .where(whereSql)
            .orderBy(desc(crmOpportunities.stageEnteredAt), desc(crmOpportunities.id))
            .limit(pageSize)
            .offset(offset);
        const points = rows.map((r) => ({
            id: `cmp_${metricKey}_${String(r.id)}`,
            metricKey,
            entityKind: 'crm',
            entityId: String(r.id || ''),
            dataSourceId: 'crm',
            date: r.stageEnteredAt ? new Date(r.stageEnteredAt).toISOString() : '',
            value: metricKey.endsWith('_usd') ? Number(r.amount ?? 0) : 1,
            dimensions: {
                name: r.name || '',
                amount: Number(r.amount ?? 0),
                stage_id: r.stageId ? String(r.stageId) : null,
                stage_name: r.stageName || null,
                stage_code: r.stageCode || null,
            },
        }));
        return { ok: true, points, pagination: { page, pageSize, total: Number(total || 0) }, meta: { metricKey, computed: true, computedOwner: ownerId, params } };
    }
    return null;
}
