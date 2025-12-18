'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button, Card, Badge } from '@hit/ui-kit';
function badgeFor(ok, labelOk, labelBad, labelUnknown = '—') {
    if (ok === null)
        return _jsx(Badge, { variant: "default", children: labelUnknown });
    if (ok)
        return _jsx(Badge, { variant: "success", children: labelOk });
    return _jsx(Badge, { variant: "error", children: labelBad });
}
export function Providers() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [items, setItems] = React.useState([]);
    async function load() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/metrics/providers', { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to load providers');
            setItems(Array.isArray(json?.data) ? json.data : []);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load providers');
        }
        finally {
            setLoading(false);
        }
    }
    React.useEffect(() => {
        void load();
    }, []);
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Providers" }), _jsx("p", { className: "text-muted-foreground", children: "A provider is an ingestor configuration + its artifacts (mappings, integrations, backfill/upload, tasks, and run state)." })] }), _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: `Providers (${items.length})`, description: "Configured from .hit/metrics/ingestors/*.yaml", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : items.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No providers configured." })) : (_jsx("div", { className: "space-y-3", children: items.map((p) => (_jsxs("div", { className: "flex items-start justify-between gap-4 border-b py-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: p.label }), _jsx("div", { className: "text-sm text-muted-foreground truncate", children: p.description || p.id }), _jsxs("div", { className: "text-xs text-muted-foreground mt-1 flex flex-wrap gap-2", children: [_jsxs("span", { children: [p.uploadEnabled ? 'Upload' : 'No upload', " \u00B7 ", p.backfillEnabled ? 'Backfill' : 'No backfill', " \u00B7 ", p.metricsCount, " metric(s)"] }), _jsxs("span", { children: ["\u00B7 files: ", p.backfillFilesCount] }), p.backfillTaskName ? _jsxs("span", { children: ["\u00B7 task: ", p.backfillTaskName] }) : _jsx("span", { children: "\u00B7 task: \u2014" }), p.syncTaskName ? _jsxs("span", { children: ["\u00B7 sync: ", p.syncTaskName] }) : null] }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [badgeFor(p.preflight.mappingOk, 'Mappings OK', `Missing ${p.preflight.mappingMissingCount ?? 0} mappings`, 'Mappings —'), p.preflight.integrationPartnerId
                                                ? badgeFor(p.preflight.integrationOk, 'Integration OK', `Missing integration (${(p.preflight.integrationMissingFields || []).join(', ') || 'required fields'})`, 'Integration —')
                                                : _jsx(Badge, { variant: "default", children: "No integration" }), p.stats.dataSourcesCount !== null ? _jsxs(Badge, { variant: "default", children: [p.stats.dataSourcesCount, " sources"] }) : null, p.stats.pointsCount !== null ? _jsxs(Badge, { variant: "info", children: [p.stats.pointsCount, " points"] }) : _jsx(Badge, { variant: "default", children: "Points \u2014" }), p.stats.lastPointDate ? _jsxs(Badge, { variant: "default", children: ["Last: ", p.stats.lastPointDate] }) : null] })] }), _jsx("div", { className: "flex gap-2", children: _jsx(Button, { variant: "secondary", size: "sm", onClick: () => (window.location.href = `/metrics/providers/${encodeURIComponent(p.id)}`), children: "Open" }) })] }, p.id))) })) })] }));
}
export default Providers;
