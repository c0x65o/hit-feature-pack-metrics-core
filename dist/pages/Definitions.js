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
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Metrics" }), _jsxs("p", { className: "text-muted-foreground", children: ["Configured metrics from ", _jsx("code", { children: ".hit/metrics/definitions" }), ", plus live data coverage from ingested points."] })] }), _jsx(Button, { variant: "secondary", onClick: () => refresh(), disabled: loading, children: "Refresh" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: `Configured metrics (${items.length})`, description: "Read-only. Configure metrics via .hit/metrics/definitions and ingest points via ingestors/sync.", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : items.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No definitions yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b text-left text-muted-foreground", children: [_jsx("th", { className: "py-3 pr-4 font-medium", children: "Metric Key" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Label" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Unit" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Category" }), _jsx("th", { className: "py-3 pr-4 font-medium text-right", children: "Points" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "First" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Last" }), _jsx("th", { className: "py-3 font-medium", children: "Updated" })] }) }), _jsx("tbody", { children: items
                                    .slice()
                                    .sort((a, b) => a.key.localeCompare(b.key))
                                    .map((d) => (_jsxs("tr", { className: "border-b hover:bg-muted/50 transition-colors", children: [_jsx("td", { className: "py-3 pr-4", children: _jsx("code", { className: "text-xs bg-muted px-1.5 py-0.5 rounded font-mono", children: d.key }) }), _jsx("td", { className: "py-3 pr-4 font-medium", children: d.label }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: "inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", children: d.unit }) }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground", children: d.category || '—' }), _jsx("td", { className: "py-3 pr-4 text-right tabular-nums", children: d.pointsCount > 0 ? (_jsx("span", { className: "text-green-600 dark:text-green-400 font-medium", children: d.pointsCount.toLocaleString() })) : (_jsx("span", { className: "text-muted-foreground", children: "0" })) }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground tabular-nums", children: d.firstPointAt ? new Date(d.firstPointAt).toLocaleDateString() : '—' }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground tabular-nums", children: d.lastPointAt ? new Date(d.lastPointAt).toLocaleDateString() : '—' }), _jsx("td", { className: "py-3 text-muted-foreground tabular-nums", children: d.lastUpdatedAt ? new Date(d.lastUpdatedAt).toLocaleDateString() : '—' })] }, d.key))) })] }) })) })] }));
}
export default Definitions;
