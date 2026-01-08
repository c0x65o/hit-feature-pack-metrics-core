import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';
// Minimal CRM table shapes (metrics-core must not depend on the CRM feature pack at build-time).
const crmPipelineStages = pgTable('crm_pipeline_stages', {
    id: uuid('id'),
    code: varchar('code', { length: 50 }),
    name: varchar('name', { length: 100 }),
    isClosedWon: boolean('is_closed_won'),
    isClosedLost: boolean('is_closed_lost'),
});
const crmOpportunities = pgTable('crm_opportunities', {
    pipelineStage: uuid('pipeline_stage'),
    amount: numeric('amount', { precision: 20, scale: 2 }),
    stageEnteredAt: timestamp('stage_entered_at'),
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
function isValidKey(k) {
    return typeof k === 'string' && /^[a-zA-Z0-9_]+$/.test(k);
}
function bucketExpr(bucket) {
    return sql `date_trunc(${bucket}, ${crmOpportunities.stageEnteredAt})`;
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
    const bucket = body.bucket || 'day';
    const agg = body.agg || 'sum';
    if (!['none', 'hour', 'day', 'week', 'month'].includes(bucket))
        return { ok: false, error: `Invalid bucket: ${bucket}` };
    if (!['sum', 'avg', 'min', 'max', 'count', 'last'].includes(agg))
        return { ok: false, error: `Invalid agg: ${agg}` };
    // CRM computed metrics are not entity-scoped yet.
    if (body.groupByEntityId)
        return { ok: false, error: 'CRM computed metrics do not support groupByEntityId' };
    if (body.entityId || (Array.isArray(body.entityIds) && body.entityIds.length > 0)) {
        return { ok: false, error: 'CRM computed metrics do not support entityId/entityIds filtering' };
    }
    // Enforce bucket rules consistent with points query:
    let start = null;
    let end = null;
    if (bucket !== 'none') {
        if (!body.start || !body.end)
            return { ok: false, error: 'Missing start/end' };
        start = new Date(body.start);
        end = new Date(body.end);
        if (Number.isNaN(start.getTime()))
            return { ok: false, error: 'Invalid start' };
        if (Number.isNaN(end.getTime()))
            return { ok: false, error: 'Invalid end' };
        if (end <= start)
            return { ok: false, error: 'end must be after start' };
    }
    else {
        if (body.start) {
            start = new Date(body.start);
            if (Number.isNaN(start.getTime()))
                return { ok: false, error: 'Invalid start' };
        }
        if (body.end) {
            end = new Date(body.end);
            if (Number.isNaN(end.getTime()))
                return { ok: false, error: 'Invalid end' };
        }
        if (start && end && end <= start)
            return { ok: false, error: 'end must be after start' };
    }
    const groupBy = Array.isArray(body.groupBy) ? body.groupBy : [];
    for (const k of groupBy) {
        if (!isValidKey(k))
            return { ok: false, error: `Invalid groupBy key: ${String(k)}` };
    }
    // Dimensions filters apply to stage fields (stage_id, stage_code, stage_name, stage_closed_won, stage_closed_lost).
    const dimFilters = body.dimensions && typeof body.dimensions === 'object' ? body.dimensions : null;
    const where = [sql `${crmOpportunities.stageEnteredAt} is not null`];
    if (start)
        where.push(sql `${crmOpportunities.stageEnteredAt} >= ${start}`);
    if (end)
        where.push(sql `${crmOpportunities.stageEnteredAt} <= ${end}`);
    if (dimFilters) {
        for (const [k, v] of Object.entries(dimFilters)) {
            if (!isValidKey(k))
                return { ok: false, error: `Invalid dimensions filter key: ${k}` };
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
                    return { ok: false, error: `Invalid boolean dimensions value for ${k}` };
                where.push(b === null ? sql `${crmPipelineStages.isClosedWon} is null` : sql `${crmPipelineStages.isClosedWon} = ${b}`);
                continue;
            }
            if (k === 'stage_closed_lost') {
                const b = v === null ? null : asBool(v);
                if (b === null)
                    return { ok: false, error: `Invalid boolean dimensions value for ${k}` };
                where.push(b === null ? sql `${crmPipelineStages.isClosedLost} is null` : sql `${crmPipelineStages.isClosedLost} = ${b}`);
                continue;
            }
            // Unknown dimension filters are not supported for this computed metric.
            return { ok: false, error: `Unsupported dimensions filter for CRM computed metric: ${k}` };
        }
    }
    // Supported computed keys (already declared by CRM pack).
    const isCount = metricKey === 'fp.crm.opportunities_stage_entered_count';
    const isAmount = metricKey === 'fp.crm.opportunities_stage_entered_amount_usd';
    if (!isCount && !isAmount)
        return null;
    // Agg semantics:
    // - count metric always returns counts (agg must NOT be last).
    // - amount metric returns sum(amount) (agg must NOT be last).
    if (agg === 'last')
        return { ok: false, error: 'agg=last is not supported for CRM computed stage-entered metrics' };
    const select = {};
    const groupExprs = [];
    const orderExprs = [];
    if (bucket !== 'none') {
        const be = bucketExpr(bucket).as('bucket');
        select.bucket = be;
        groupExprs.push(be);
        orderExprs.push(sql `bucket`);
    }
    // Resolve groupBy keys from stage columns.
    for (const k of groupBy) {
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
        return { ok: false, error: `Unsupported groupBy key for CRM computed metric: ${k}` };
    }
    if (isCount) {
        // count(*) as value
        select.value = sql `count(*)::float8`.as('value');
    }
    else {
        // sum(amount) as value (null-safe)
        select.value = sql `coalesce(sum(${crmOpportunities.amount}), 0)::float8`.as('value');
    }
    // Build query
    // Note: opportunities always reference a stage_id, but keep join as left to be safe if data is inconsistent.
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
        },
    };
}
