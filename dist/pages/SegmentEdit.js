import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useUi } from '@hit/ui-kit';
function safeJsonParse(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
}
export function SegmentEdit(props) {
    const { Page, Card, Button, Input, TextArea, Select } = useUi();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [segmentKeyFromRoute, setSegmentKeyFromRoute] = useState('');
    const [key, setKey] = useState('');
    const [entityKind, setEntityKind] = useState('project');
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [ruleText, setRuleText] = useState(JSON.stringify({
        kind: 'metric_threshold',
        metricKey: 'metric_key_here',
        agg: 'sum',
        op: '>=',
        value: 100000,
    }, null, 2));
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    // Optional: expose this segment as a DataTable-derived column
    // - bucket: categorical column driven by segment membership (metric_threshold, static lists, etc)
    // - metric: numeric computed metric column (rule.kind="table_metric")
    const [tableIntegration, setTableIntegration] = useState('none');
    const [tableId, setTableId] = useState('projects');
    const [columnKey, setColumnKey] = useState('');
    const [columnLabel, setColumnLabel] = useState('');
    const [sortOrder, setSortOrder] = useState('0');
    const [entityIdField, setEntityIdField] = useState('id');
    // Bucket-only
    const [bucketLabel, setBucketLabel] = useState('');
    // Metric-only
    const [metricKey, setMetricKey] = useState('');
    const [metricAgg, setMetricAgg] = useState('sum');
    const [metricWindow, setMetricWindow] = useState('last_30_days');
    const [metricFormat, setMetricFormat] = useState('');
    const [metricDecimals, setMetricDecimals] = useState('2');
    // Extract key from URL pathname (similar to ProviderDetail pattern)
    useEffect(() => {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const segmentsIdx = parts.indexOf('segments');
        if (segmentsIdx >= 0 && parts[segmentsIdx + 1] === 'new') {
            setSegmentKeyFromRoute('');
        }
        else if (segmentsIdx >= 0 && parts[segmentsIdx + 2] === 'edit') {
            setSegmentKeyFromRoute(decodeURIComponent(parts[segmentsIdx + 1] || ''));
        }
    }, []);
    const editingKey = props.key || segmentKeyFromRoute || null;
    const isEditMode = Boolean(editingKey);
    const navigate = (path) => {
        if (props.onNavigate)
            props.onNavigate(path);
        else
            window.location.href = path;
    };
    useEffect(() => {
        if (isEditMode && editingKey) {
            loadSegment();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segmentKeyFromRoute]);
    async function loadSegment() {
        if (!editingKey)
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/metrics/segments/${encodeURIComponent(editingKey)}`, { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || `Failed to load segment (${res.status})`);
            const segment = json?.data;
            if (segment) {
                setKey(segment.key);
                setEntityKind(segment.entityKind);
                setLabel(segment.label);
                setDescription(segment.description || '');
                setIsActive(Boolean(segment.isActive));
                setRuleText(JSON.stringify(segment.rule ?? { kind: 'metric_threshold' }, null, 2));
                // Load DataTable integration metadata from rule.table if present
                const rule = segment.rule && typeof segment.rule === 'object' ? segment.rule : null;
                const table = rule?.table && typeof rule.table === 'object' ? rule.table : null;
                if (table) {
                    const tId = typeof table.tableId === 'string' ? table.tableId.trim() : '';
                    const cKey = typeof table.columnKey === 'string' ? table.columnKey.trim() : '';
                    if (tId)
                        setTableId(tId);
                    if (cKey)
                        setColumnKey(cKey);
                    setColumnLabel(typeof table.columnLabel === 'string' ? table.columnLabel.trim() : '');
                    setSortOrder(String(table.sortOrder ?? '0'));
                    setEntityIdField(typeof table.entityIdField === 'string' && table.entityIdField.trim() ? table.entityIdField.trim() : 'id');
                    const kind = typeof rule?.kind === 'string' ? String(rule.kind).trim() : '';
                    if (kind === 'table_metric') {
                        setTableIntegration(Boolean(tId && cKey) ? 'metric' : 'none');
                        setMetricKey(typeof rule?.metricKey === 'string' ? String(rule.metricKey).trim() : '');
                        const agg = typeof rule?.agg === 'string' ? String(rule.agg).trim() : '';
                        setMetricAgg(agg === 'avg' || agg === 'min' || agg === 'max' || agg === 'count' || agg === 'last' ? agg : 'sum');
                        const w = typeof rule?.window === 'string' ? String(rule.window).trim() : '';
                        setMetricWindow(w === 'last_7_days' || w === 'last_30_days' || w === 'last_90_days' || w === 'month_to_date' || w === 'year_to_date' || w === 'all_time'
                            ? w
                            : '');
                        setMetricFormat(typeof table.format === 'string' ? String(table.format).trim() : '');
                        setMetricDecimals(table.decimals === null || table.decimals === undefined ? '' : String(table.decimals));
                        setBucketLabel('');
                    }
                    else {
                        const bLabel = typeof table.bucketLabel === 'string' ? table.bucketLabel.trim() : '';
                        setBucketLabel(bLabel);
                        setTableIntegration(Boolean(tId && cKey && bLabel) ? 'bucket' : 'none');
                        setMetricKey('');
                    }
                }
                else {
                    setTableIntegration('none');
                }
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load segment');
        }
        finally {
            setLoading(false);
        }
    }
    async function save() {
        const parsed = safeJsonParse(ruleText);
        if (!parsed.ok) {
            setError(`Rule JSON error: ${parsed.error}`);
            return;
        }
        const nextRule = parsed.value && typeof parsed.value === 'object' ? { ...parsed.value } : parsed.value;
        if (!nextRule || typeof nextRule !== 'object') {
            setError('Rule must be a JSON object');
            return;
        }
        if (tableIntegration === 'bucket') {
            const tId = String(tableId || '').trim();
            const cKey = String(columnKey || '').trim();
            const bLabel = String(bucketLabel || '').trim();
            if (!tId)
                return setError('Table bucket config: tableId is required');
            if (!cKey)
                return setError('Table bucket config: columnKey is required');
            if (!bLabel)
                return setError('Table bucket config: bucketLabel is required');
            const so = Number(sortOrder || 0) || 0;
            nextRule.table = {
                tableId: tId,
                columnKey: cKey,
                columnLabel: String(columnLabel || '').trim() || undefined,
                bucketLabel: bLabel,
                sortOrder: so,
                entityIdField: String(entityIdField || '').trim() || 'id',
            };
        }
        else if (tableIntegration === 'metric') {
            const tId = String(tableId || '').trim();
            const cKey = String(columnKey || '').trim();
            const mKey = String(metricKey || '').trim();
            if (!tId)
                return setError('Table metric config: tableId is required');
            if (!cKey)
                return setError('Table metric config: columnKey is required');
            if (!mKey)
                return setError('Table metric config: metricKey is required');
            const so = Number(sortOrder || 0) || 0;
            const dec = metricDecimals.trim() === '' ? null : Number(metricDecimals);
            const decNorm = dec === null ? null : Number.isFinite(dec) ? Math.max(0, Math.min(12, Math.floor(dec))) : null;
            nextRule.kind = 'table_metric';
            nextRule.metricKey = mKey;
            nextRule.agg = metricAgg;
            if (metricWindow)
                nextRule.window = metricWindow;
            else
                delete nextRule.window;
            nextRule.table = {
                tableId: tId,
                columnKey: cKey,
                columnLabel: String(columnLabel || '').trim() || undefined,
                format: String(metricFormat || '').trim() || undefined,
                decimals: decNorm,
                sortOrder: so,
                entityIdField: String(entityIdField || '').trim() || 'id',
            };
        }
        else if (nextRule.table) {
            // none: remove any existing table linkage
            delete nextRule.table;
        }
        setSaving(true);
        setError(null);
        try {
            if (!editingKey) {
                const res = await fetch('/api/metrics/segments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key,
                        entityKind,
                        label,
                        description: description.trim() ? description : null,
                        rule: nextRule,
                        isActive,
                    }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || `Failed to create (${res.status})`);
            }
            else {
                const res = await fetch(`/api/metrics/segments/${encodeURIComponent(editingKey)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        label,
                        description: description.trim() ? description : null,
                        rule: nextRule,
                        isActive,
                    }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || `Failed to update (${res.status})`);
            }
            navigate('/metrics/segments');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsx(Page, { title: isEditMode ? 'Edit Segment' : 'New Segment', description: "Segments are reusable selection rules. Store a stable key so other systems can reference it.", actions: _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx(Button, { variant: "ghost", onClick: () => navigate('/metrics/segments'), disabled: saving, children: "Cancel" }), _jsx(Button, { variant: "primary", onClick: save, loading: saving, disabled: loading || !key.trim() || !label.trim() || !entityKind.trim(), children: "Save" })] }), children: _jsxs(Card, { children: [error ? _jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }, children: error }) : null, loading ? (_jsx("div", { style: { padding: '24px', textAlign: 'center' }, children: "Loading..." })) : (_jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "Key", value: key, onChange: setKey, placeholder: "segment.project.revenue_gte_100k_all_time", required: true, disabled: Boolean(editingKey) }), _jsx(Input, { label: "Label", value: label, onChange: setLabel, placeholder: "High Revenue Projects", required: true }), _jsx(Select, { label: "Entity Kind", value: entityKind, onChange: setEntityKind, options: [{ value: 'project', label: 'Project' }], required: true, disabled: Boolean(editingKey) }), _jsx(Input, { label: "Description", value: description, onChange: setDescription, placeholder: "Optional" }), _jsx(TextArea, { label: "Rule (JSON)", value: ruleText, onChange: setRuleText, rows: 12, placeholder: '{"kind":"metric_threshold","metricKey":"metric_key_here","agg":"sum","op":">=","value":100000}' }), _jsxs("div", { style: { borderTop: '1px solid var(--hit-border, #e2e8f0)', paddingTop: 12 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 8 }, children: "DataTable column (optional)" }), _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }, children: [_jsx(Select, { label: "Type", value: tableIntegration, onChange: (v) => setTableIntegration(v || 'none'), options: [
                                                { value: 'none', label: 'None' },
                                                { value: 'bucket', label: 'Bucket column (categorical)' },
                                                { value: 'metric', label: 'Metric column (numeric)' },
                                            ] }), _jsx(Input, { label: "Table ID", value: tableId, onChange: setTableId, placeholder: "projects" }), _jsx(Input, { label: "Column Key", value: columnKey, onChange: setColumnKey, placeholder: tableIntegration === 'metric' ? 'revenue_30d_usd' : 'revenue_bucket_30d' }), _jsx(Input, { label: "Column Label", value: columnLabel, onChange: setColumnLabel, placeholder: tableIntegration === 'metric' ? 'Gross Revenue (30d)' : 'Revenue Bucket (30d)' }), _jsx(Input, { label: "Sort Order", value: sortOrder, onChange: setSortOrder, placeholder: "10" }), _jsx(Input, { label: "Entity ID Field", value: entityIdField, onChange: setEntityIdField, placeholder: "id" })] }), tableIntegration === 'bucket' ? (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }, children: _jsx(Input, { label: "Bucket Label", value: bucketLabel, onChange: setBucketLabel, placeholder: "Under $500" }) }), _jsx("div", { style: { marginTop: 6, fontSize: 12, color: 'var(--hit-muted-foreground, #64748b)' }, children: "Adds/updates a derived categorical column based on this segment. The bucket label is what shows in the table and grouping UI." })] })) : null, tableIntegration === 'metric' ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }, children: [_jsx(Input, { label: "Metric Key", value: metricKey, onChange: setMetricKey, placeholder: "gross_revenue_usd" }), _jsx(Select, { label: "Agg", value: metricAgg, onChange: (v) => setMetricAgg(v || 'sum'), options: [
                                                        { value: 'sum', label: 'sum' },
                                                        { value: 'avg', label: 'avg' },
                                                        { value: 'min', label: 'min' },
                                                        { value: 'max', label: 'max' },
                                                        { value: 'count', label: 'count' },
                                                        { value: 'last', label: 'last' },
                                                    ] }), _jsx(Select, { label: "Window", value: metricWindow || '', onChange: (v) => setMetricWindow(v || ''), options: [
                                                        { value: 'last_7_days', label: 'last_7_days' },
                                                        { value: 'last_30_days', label: 'last_30_days' },
                                                        { value: 'last_90_days', label: 'last_90_days' },
                                                        { value: 'month_to_date', label: 'month_to_date' },
                                                        { value: 'year_to_date', label: 'year_to_date' },
                                                        { value: 'all_time', label: 'all_time' },
                                                    ] }), _jsx(Input, { label: "Format", value: metricFormat, onChange: setMetricFormat, placeholder: "usd" }), _jsx(Input, { label: "Decimals", value: metricDecimals, onChange: setMetricDecimals, placeholder: "2" })] }), _jsxs("div", { style: { marginTop: 6, fontSize: 12, color: 'var(--hit-muted-foreground, #64748b)' }, children: ["Creates a computed numeric column (rule.kind=", _jsx("code", { children: "table_metric" }), ") that DataTable will auto-discover when ", _jsx("code", { children: "tableId" }), " matches. Values come from ", _jsx("code", { children: "metrics_metric_points" }), " for the selected ", _jsx("code", { children: "metricKey" }), "."] })] })) : null] }), _jsx(Select, { label: "Status", value: isActive ? 'active' : 'inactive', onChange: (v) => setIsActive(v === 'active'), options: [
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                            ] })] }))] }) }));
}
export default SegmentEdit;
