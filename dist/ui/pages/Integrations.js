import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useUi } from '@hit/ui-kit';
export function Integrations(props) {
    const { Page, Card, Button, Table, Badge } = useUi();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
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
            const res = await fetch('/api/metrics/partners', { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to load partners');
            setItems(Array.isArray(json?.data) ? json.data : []);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load partners');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void load();
    }, []);
    const statusBadge = (p) => {
        if (!p.configured)
            return _jsx(Badge, { variant: "default", children: "Not configured" });
        if (!p.enabled)
            return _jsx(Badge, { variant: "default", children: "Disabled" });
        if (p.lastVerifyOk === true)
            return _jsx(Badge, { variant: "success", children: "Verified" });
        if (p.lastVerifyOk === false)
            return _jsx(Badge, { variant: "error", children: "Verify failed" });
        return _jsx(Badge, { variant: "default", children: "Not verified" });
    };
    return (_jsx(Page, { title: "Integrations", description: "Configure integration partner credentials (API keys, tokens) and optionally verify connectivity.", actions: _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" }), children: _jsxs(Card, { children: [error && (_jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)', fontSize: '14px' }, children: error })), _jsx(Table, { loading: loading, emptyMessage: "No partners configured. Add partner definitions under .hit/metrics/partners/*.yaml", columns: [
                        { key: 'label', label: 'Partner' },
                        { key: 'status', label: 'Status' },
                        { key: 'lastVerified', label: 'Last verified' },
                        { key: 'actions', label: '' },
                    ], data: items.map((p) => ({
                        label: (_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: p.label }), _jsx("div", { style: { fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }, children: p.id }), p.description ? (_jsx("div", { style: { marginTop: '4px', fontSize: '13px', color: 'var(--hit-muted-foreground, #64748b)' }, children: p.description })) : null] })),
                        status: statusBadge(p),
                        lastVerified: p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toLocaleString() : '—',
                        actions: (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => navigate(`/metrics/integrations/${p.id}`), children: "Manage" })),
                    })) })] }) }));
}
export default Integrations;
