'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button, Card } from '@hit/ui-kit';
export function Definitions() {
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    async function refresh() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/metrics/catalog');
            if (!res.ok)
                throw new Error(`Failed to load: ${res.status}`);
            const json = (await res.json());
            setItems(Array.isArray(json.items) ? json.items : []);
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
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Metrics" }), _jsxs("p", { className: "text-muted-foreground", children: ["Configured metrics from ", _jsx("code", { children: ".hit/metrics/definitions" }), ", plus live data coverage from ingested points."] })] }), _jsx(Button, { variant: "secondary", onClick: () => refresh(), disabled: loading, children: "Refresh" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: `Configured metrics (${items.length})`, description: "Read-only. Configure metrics via .hit/metrics/definitions and ingest points via ingestors/sync.", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : items.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No definitions yet." })) : (_jsx("div", { className: "space-y-2", children: items
                        .slice()
                        .sort((a, b) => a.key.localeCompare(b.key))
                        .map((d) => (_jsx("div", { className: "flex items-start justify-between gap-4 border-b py-2", children: _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: d.key }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [d.label, " \u00B7 ", d.unit, d.category ? ` · ${d.category}` : ''] }), _jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: [d.pointsCount.toLocaleString(), " point(s)", d.firstPointAt ? ` · first: ${new Date(d.firstPointAt).toISOString().slice(0, 10)}` : ' · first: —', d.lastPointAt ? ` · last: ${new Date(d.lastPointAt).toISOString().slice(0, 10)}` : ' · last: —', d.lastUpdatedAt ? ` · updated: ${new Date(d.lastUpdatedAt).toISOString().slice(0, 10)}` : ' · updated: —'] })] }) }, d.key))) })) })] }));
}
export default Definitions;
