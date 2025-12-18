'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button, Card } from '@hit/ui-kit';
export function DataSources() {
    const [sources, setSources] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    async function refresh() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/metrics/data-sources');
            if (!res.ok)
                throw new Error(`Failed to load: ${res.status}`);
            const json = (await res.json());
            setSources(Array.isArray(json.data) ? json.data : []);
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
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Data Sources" }), _jsx("p", { className: "text-muted-foreground", children: "Data sources are the \u201Cinventory\u201D of connectors/configs that produce metric points." })] }), _jsx(Button, { variant: "secondary", onClick: () => refresh(), disabled: loading, children: "Refresh" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: `Data Sources (${sources.length})`, description: "Current configured data sources.", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : sources.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No data sources yet." })) : (_jsx("div", { className: "space-y-2", children: sources
                        .slice()
                        .sort((a, b) => a.connectorKey.localeCompare(b.connectorKey))
                        .map((s) => (_jsx("div", { className: "flex items-start justify-between gap-4 border-b py-2", children: _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: s.connectorKey }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [s.entityKind, ":", s.entityId, " \u00B7 ", s.sourceKind, s.externalRef ? ` · ${s.externalRef}` : '', s.enabled ? '' : ' · disabled'] })] }) }, s.id))) })) })] }));
}
export default DataSources;
