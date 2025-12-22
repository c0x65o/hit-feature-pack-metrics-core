import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
function safeJsonParse(text) {
    try {
        return { ok: true, value: JSON.parse(text) };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
}
export function Segments(props) {
    const { Page, Card, Button, Input, TextArea, Table, Badge, Modal, Select } = useUi();
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState(null);
    const [q, setQ] = useState('');
    const [entityKindFilter, setEntityKindFilter] = useState('');
    // Create/edit modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [key, setKey] = useState('');
    const [entityKind, setEntityKind] = useState('project');
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [ruleText, setRuleText] = useState(JSON.stringify({
        kind: 'metric_threshold',
        metricKey: 'revenue_usd',
        agg: 'sum',
        op: '>=',
        value: 100000,
        // Optional:
        // start: '2025-01-01T00:00:00.000Z',
        // end: '2026-01-01T00:00:00.000Z',
    }, null, 2));
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const navigate = (path) => {
        if (props.onNavigate)
            props.onNavigate(path);
        else
            window.location.href = path;
    };
    async function load() {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/metrics/segments', window.location.origin);
            if (q.trim())
                url.searchParams.set('q', q.trim());
            if (entityKindFilter.trim())
                url.searchParams.set('entityKind', entityKindFilter.trim());
            const res = await fetch(url.toString(), { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || `Failed to load segments (${res.status})`);
            setRows(Array.isArray(json?.data) ? json.data : []);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load segments');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const entityKinds = useMemo(() => {
        const s = new Set();
        for (const r of rows)
            s.add(String(r.entityKind || ''));
        return Array.from(s).filter(Boolean).sort();
    }, [rows]);
    function openCreate() {
        setEditingKey(null);
        setKey('');
        setEntityKind('project');
        setLabel('');
        setDescription('');
        setIsActive(true);
        setRuleText(JSON.stringify({ kind: 'metric_threshold', metricKey: 'revenue_usd', agg: 'sum', op: '>=', value: 100000 }, null, 2));
        setModalOpen(true);
    }
    function openEdit(row) {
        setEditingKey(row.key);
        setKey(row.key);
        setEntityKind(row.entityKind);
        setLabel(row.label);
        setDescription(row.description || '');
        setIsActive(Boolean(row.isActive));
        setRuleText(JSON.stringify(row.rule ?? { kind: 'metric_threshold' }, null, 2));
        setModalOpen(true);
    }
    async function save() {
        const parsed = safeJsonParse(ruleText);
        if (!parsed.ok) {
            setError(`Rule JSON error: ${parsed.error}`);
            return;
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
                        rule: parsed.value,
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
                        rule: parsed.value,
                        isActive,
                    }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || `Failed to update (${res.status})`);
            }
            setModalOpen(false);
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        }
        finally {
            setSaving(false);
        }
    }
    async function deleteRow(row) {
        if (!confirm(`Delete segment "${row.key}"?`))
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/metrics/segments/${encodeURIComponent(row.key)}`, { method: 'DELETE' });
            if (!(res.status === 204 || res.ok)) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.error || `Failed to delete (${res.status})`);
            }
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed');
        }
        finally {
            setLoading(false);
        }
    }
    const activeBadge = (r) => r.isActive ? _jsx(Badge, { variant: "success", children: "Active" }) : _jsx(Badge, { variant: "default", children: "Inactive" });
    return (_jsxs(Page, { title: "Segments", description: "Reusable selection/classification rules over entities (projects, users, etc.). Use segments for filters, dashboard scoping, and workflow targeting.", actions: _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" }), _jsx(Button, { variant: "primary", onClick: openCreate, children: "New Segment" })] }), children: [_jsxs(Card, { children: [error ? _jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }, children: error }) : null, _jsxs("div", { style: { display: 'flex', gap: '12px', alignItems: 'end', marginBottom: '12px', flexWrap: 'wrap' }, children: [_jsx(Input, { label: "Search", value: q, onChange: setQ }), _jsx(Select, { label: "Entity kind", value: entityKindFilter, onChange: setEntityKindFilter, options: [
                                    { value: '', label: 'All' },
                                    ...entityKinds.map((k) => ({ value: k, label: k })),
                                ] }), _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Apply" })] }), _jsx(Table, { loading: loading, emptyMessage: "No segments found.", columns: [
                            { key: 'key', label: 'Key' },
                            { key: 'entityKind', label: 'Entity' },
                            { key: 'label', label: 'Label' },
                            { key: 'status', label: 'Status' },
                            { key: 'rule', label: 'Rule' },
                            { key: 'actions', label: '' },
                        ], data: rows.map((r) => ({
                            key: (_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: r.key }), r.description ? (_jsx("div", { style: { marginTop: '4px', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }, children: r.description })) : null] })),
                            entityKind: _jsx("span", { style: { fontFamily: 'monospace', fontSize: '12px' }, children: r.entityKind }),
                            label: r.label,
                            status: activeBadge(r),
                            rule: (_jsxs("details", { children: [_jsx("summary", { style: { cursor: 'pointer', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }, children: "View" }), _jsx("pre", { style: { marginTop: '6px', fontSize: '11px', overflow: 'auto' }, children: JSON.stringify(r.rule ?? {}, null, 2) })] })),
                            actions: (_jsxs("div", { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => openEdit(r), children: "Edit" }), _jsx(Button, { variant: "danger", size: "sm", onClick: () => deleteRow(r), children: "Delete" })] })),
                        })) })] }), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: editingKey ? 'Edit Segment' : 'New Segment', description: "Segments are reusable selection rules. Store a stable key so other systems can reference it.", size: "lg", children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "Key", value: key, onChange: setKey, placeholder: "segment.project.revenue_gte_100k_all_time", required: true, disabled: Boolean(editingKey) }), _jsx(Input, { label: "Label", value: label, onChange: setLabel, placeholder: "High Revenue Projects", required: true }), _jsx(Input, { label: "Entity Kind", value: entityKind, onChange: setEntityKind, placeholder: "project", required: true, disabled: Boolean(editingKey) }), _jsx(Input, { label: "Description", value: description, onChange: setDescription, placeholder: "Optional" }), _jsx(TextArea, { label: "Rule (JSON)", value: ruleText, onChange: setRuleText, rows: 12, placeholder: '{"kind":"metric_threshold","metricKey":"revenue_usd","agg":"sum","op":">=","value":100000}' }), _jsx(Select, { label: "Status", value: isActive ? 'active' : 'inactive', onChange: (v) => setIsActive(v === 'active'), options: [
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                            ] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' }, children: [_jsx(Button, { variant: "ghost", onClick: () => setModalOpen(false), disabled: saving, children: "Cancel" }), _jsx(Button, { variant: "primary", onClick: save, loading: saving, disabled: !key.trim() || !label.trim() || !entityKind.trim(), children: "Save" })] })] }) })] }));
}
export default Segments;
