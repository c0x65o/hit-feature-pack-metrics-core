import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
export function Segments(props) {
    const { Page, Card, Button, Table, Badge } = useUi();
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState(null);
    const [q, setQ] = useState('');
    const [entityKindFilter, setEntityKindFilter] = useState('');
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
    return (_jsx(Page, { title: "Segments", description: "Reusable selection/classification rules over entities (projects, users, etc.). Use segments for filters, dashboard scoping, and workflow targeting.", actions: _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" }), _jsx(Button, { variant: "primary", onClick: () => navigate('/metrics/segments/new'), children: "New Segment" })] }), children: _jsxs(Card, { children: [error ? _jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }, children: error }) : null, _jsxs("div", { style: { display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }, children: [_jsxs("div", { style: { flex: '1 1 200px', maxWidth: '300px' }, children: [_jsx("label", { style: { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--hit-text-secondary, #64748b)' }, children: "Search" }), _jsx("input", { type: "text", value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search segments...", style: {
                                        width: '100%',
                                        height: '36px',
                                        padding: '0 12px',
                                        fontSize: '14px',
                                        border: '1px solid var(--hit-border, #e2e8f0)',
                                        borderRadius: '6px',
                                        backgroundColor: 'var(--hit-bg-input, #fff)',
                                        color: 'var(--hit-text-primary, #1e293b)',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    } })] }), _jsxs("div", { style: { flex: '0 0 auto', minWidth: '140px' }, children: [_jsx("label", { style: { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--hit-text-secondary, #64748b)' }, children: "Entity kind" }), _jsxs("select", { value: entityKindFilter, onChange: (e) => setEntityKindFilter(e.target.value), style: {
                                        width: '100%',
                                        height: '36px',
                                        padding: '0 12px',
                                        fontSize: '14px',
                                        border: '1px solid var(--hit-border, #e2e8f0)',
                                        borderRadius: '6px',
                                        backgroundColor: 'var(--hit-bg-input, #fff)',
                                        color: 'var(--hit-text-primary, #1e293b)',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        cursor: 'pointer',
                                    }, children: [_jsx("option", { value: "", children: "All" }), entityKinds.map((k) => (_jsx("option", { value: k, children: k }, k)))] })] }), _jsx("div", { style: { flex: '0 0 auto' }, children: _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Apply" }) })] }), _jsx(Table, { loading: loading, emptyMessage: "No segments found.", columns: [
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
                        actions: (_jsxs("div", { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => navigate(`/metrics/segments/${encodeURIComponent(r.key)}/edit`), children: "Edit" }), _jsx(Button, { variant: "danger", size: "sm", onClick: () => deleteRow(r), children: "Delete" })] })),
                    })) })] }) }));
}
export default Segments;
