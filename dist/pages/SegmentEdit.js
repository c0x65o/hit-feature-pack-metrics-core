import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    // Optional: expose this segment as a "bucket column" for a DataTable
    const [tableBucketEnabled, setTableBucketEnabled] = useState(false);
    const [tableId, setTableId] = useState('projects');
    const [columnKey, setColumnKey] = useState('');
    const [columnLabel, setColumnLabel] = useState('');
    const [bucketLabel, setBucketLabel] = useState('');
    const [sortOrder, setSortOrder] = useState('0');
    const [entityIdField, setEntityIdField] = useState('id');
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
                // Load table bucket metadata from rule.table if present
                const rule = segment.rule && typeof segment.rule === 'object' ? segment.rule : null;
                const table = rule?.table && typeof rule.table === 'object' ? rule.table : null;
                if (table) {
                    const tId = typeof table.tableId === 'string' ? table.tableId.trim() : '';
                    const cKey = typeof table.columnKey === 'string' ? table.columnKey.trim() : '';
                    const bLabel = typeof table.bucketLabel === 'string' ? table.bucketLabel.trim() : '';
                    setTableBucketEnabled(Boolean(tId && cKey && bLabel));
                    if (tId)
                        setTableId(tId);
                    if (cKey)
                        setColumnKey(cKey);
                    setColumnLabel(typeof table.columnLabel === 'string' ? table.columnLabel.trim() : '');
                    setBucketLabel(bLabel);
                    setSortOrder(String(table.sortOrder ?? '0'));
                    setEntityIdField(typeof table.entityIdField === 'string' && table.entityIdField.trim() ? table.entityIdField.trim() : 'id');
                }
                else {
                    setTableBucketEnabled(false);
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
        if (tableBucketEnabled) {
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
        else if (nextRule.table) {
            // If disabled, remove any existing table linkage
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
    return (_jsx(Page, { title: isEditMode ? 'Edit Segment' : 'New Segment', description: "Segments are reusable selection rules. Store a stable key so other systems can reference it.", actions: _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx(Button, { variant: "ghost", onClick: () => navigate('/metrics/segments'), disabled: saving, children: "Cancel" }), _jsx(Button, { variant: "primary", onClick: save, loading: saving, disabled: loading || !key.trim() || !label.trim() || !entityKind.trim(), children: "Save" })] }), children: _jsxs(Card, { children: [error ? _jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }, children: error }) : null, loading ? (_jsx("div", { style: { padding: '24px', textAlign: 'center' }, children: "Loading..." })) : (_jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "Key", value: key, onChange: setKey, placeholder: "segment.project.revenue_gte_100k_all_time", required: true, disabled: Boolean(editingKey) }), _jsx(Input, { label: "Label", value: label, onChange: setLabel, placeholder: "High Revenue Projects", required: true }), _jsx(Select, { label: "Entity Kind", value: entityKind, onChange: setEntityKind, options: [{ value: 'project', label: 'Project' }], required: true, disabled: Boolean(editingKey) }), _jsx(Input, { label: "Description", value: description, onChange: setDescription, placeholder: "Optional" }), _jsx(TextArea, { label: "Rule (JSON)", value: ruleText, onChange: setRuleText, rows: 12, placeholder: '{"kind":"metric_threshold","metricKey":"metric_key_here","agg":"sum","op":">=","value":100000}' }), _jsxs("div", { style: { borderTop: '1px solid var(--hit-border, #e2e8f0)', paddingTop: 12 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 8 }, children: "Table bucket column (optional)" }), _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }, children: [_jsx(Select, { label: "Enabled", value: tableBucketEnabled ? 'yes' : 'no', onChange: (v) => setTableBucketEnabled(v === 'yes'), options: [
                                                { value: 'no', label: 'No' },
                                                { value: 'yes', label: 'Yes' },
                                            ] }), _jsx(Input, { label: "Table ID", value: tableId, onChange: setTableId, placeholder: "projects" }), _jsx(Input, { label: "Column Key", value: columnKey, onChange: setColumnKey, placeholder: "revenue_bucket_30d" }), _jsx(Input, { label: "Column Label", value: columnLabel, onChange: setColumnLabel, placeholder: "Revenue Bucket (30d)" }), _jsx(Input, { label: "Bucket Label", value: bucketLabel, onChange: setBucketLabel, placeholder: "Under $500" }), _jsx(Input, { label: "Sort Order", value: sortOrder, onChange: setSortOrder, placeholder: "10" }), _jsx(Input, { label: "Entity ID Field", value: entityIdField, onChange: setEntityIdField, placeholder: "id" })] }), _jsx("div", { style: { marginTop: 6, fontSize: 12, color: 'var(--hit-muted-foreground, #64748b)' }, children: "This links the segment into a DataTable as a derived \u201Cbucket\u201D column for grouping. Buckets are ordered by Sort Order." })] }), _jsx(Select, { label: "Status", value: isActive ? 'active' : 'inactive', onChange: (v) => setIsActive(v === 'active'), options: [
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                            ] })] }))] }) }));
}
export default SegmentEdit;
