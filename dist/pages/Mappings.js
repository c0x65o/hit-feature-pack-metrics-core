import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
export function Mappings(props) {
    const { Page, Card, Button, Input, Table } = useUi();
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState(null);
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
            const url = new URL('/api/metrics/links', window.location.origin);
            if (q.trim())
                url.searchParams.set('q', q.trim());
            url.searchParams.set('limit', '500');
            const res = await fetch(url.toString(), { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to load mappings');
            setRows(Array.isArray(json?.data) ? json.data : []);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load mappings');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const examples = useMemo(() => {
        return `Examples:\n\nSteam CSV filename → project:\n- linkType = "metrics.field_mapper"\n- linkId = EXACT filename (e.g. "Aquamarine - Sales Data.csv")\n- metadata = { "project_slug": "aquamarine" }`;
    }, []);
    return (_jsx(Page, { title: "Mappings", description: "Manage metrics_links rows used for filename\u2192id mappings and other global metadata.", actions: _jsx("div", { style: { display: 'flex', gap: '8px' }, children: _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" }) }), children: _jsxs(Card, { children: [error ? _jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }, children: error }) : null, _jsxs("div", { style: { display: 'flex', gap: '12px', alignItems: 'end', marginBottom: '12px' }, children: [_jsx(Input, { label: "Search link id", value: q, onChange: setQ }), _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Search" })] }), _jsx("pre", { style: { fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)', whiteSpace: 'pre-wrap' }, children: examples }), _jsx("div", { style: { marginTop: '12px' }, children: _jsx(Table, { loading: loading, emptyMessage: "No mappings found.", columns: [
                            { key: 'linkType', label: 'Link Type' },
                            { key: 'linkId', label: 'Link ID' },
                            { key: 'target', label: 'Target' },
                            { key: 'metadata', label: 'Metadata' },
                            { key: 'updated', label: 'Updated' },
                            { key: 'actions', label: '' },
                        ], data: rows.map((r) => ({
                            linkType: r.linkType,
                            linkId: r.linkId,
                            target: r.targetKind && r.targetKind !== 'none' ? `${r.targetKind}:${r.targetId}` : '—',
                            metadata: (_jsxs("details", { children: [_jsx("summary", { style: { cursor: 'pointer', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }, children: "View" }), _jsx("pre", { style: { marginTop: '6px', fontSize: '11px', overflow: 'auto' }, children: JSON.stringify(r.metadata ?? {}, null, 2) })] })),
                            updated: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—',
                            actions: (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => navigate(`/metrics/mappings/${encodeURIComponent(r.linkType)}#edit=${encodeURIComponent(r.id)}`), children: "Edit" })),
                        })) }) })] }) }));
}
export default Mappings;
