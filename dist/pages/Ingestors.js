'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button, Card } from '@hit/ui-kit';
export function Ingestors() {
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    async function refresh() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/metrics/ingestors');
            if (!res.ok)
                throw new Error(`Failed to load ingestors: ${res.status}`);
            const json = (await res.json());
            setItems(Array.isArray(json.ingestors) ? json.ingestors : []);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }
    React.useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Metric Ingestors" }), _jsxs("p", { className: "text-muted-foreground", children: ["Config-driven ingestion sources from ", _jsx("code", { children: ".hit/metrics/ingestors" }), "."] })] }), _jsx(Button, { variant: "secondary", onClick: () => refresh(), disabled: loading, children: "Refresh" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: `Ingestors (${items.length})`, description: "Each ingestor may support upload, backfill, and/or scheduled sync.", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : items.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No ingestors configured." })) : (_jsx("div", { className: "space-y-3", children: items.map((ing) => (_jsxs("div", { className: "flex items-start justify-between gap-4 border-b py-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: ing.label || ing.id }), _jsx("div", { className: "text-sm text-muted-foreground", children: ing.description || ing.id }), _jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: [ing.upload?.enabled ? 'Upload' : 'No upload', " \u00B7 ", ing.backfill?.enabled ? 'Backfill' : 'No backfill', ing.metrics?.length ? ` · ${ing.metrics.length} metric(s)` : ''] })] }), _jsx("div", { className: "flex gap-2", children: ing.upload?.enabled ? (_jsx(Button, { variant: "primary", size: "sm", onClick: () => (window.location.href = `/metrics/ingestors/${encodeURIComponent(ing.id)}`), children: "Open" })) : (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => (window.location.href = `/metrics/ingestors/${encodeURIComponent(ing.id)}`), children: "Open" })) })] }, ing.id))) })) })] }));
}
export default Ingestors;
