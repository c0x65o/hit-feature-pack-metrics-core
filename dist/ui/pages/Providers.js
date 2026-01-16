'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Badge } from '@hit/ui-kit/components/Badge';
import { Button } from '@hit/ui-kit/components/Button';
import { Card } from '@hit/ui-kit/components/Card';
function badgeFor(ok, labelOk, labelBad, labelUnknown = '—') {
    if (ok === null)
        return _jsx(Badge, { variant: "default", children: labelUnknown });
    if (ok)
        return _jsx(Badge, { variant: "success", children: labelOk });
    return _jsx(Badge, { variant: "error", children: labelBad });
}
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    if (diffSeconds < 60) {
        return 'just now';
    }
    else if (diffMinutes < 60) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    else if (diffDays < 7) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    else if (diffWeeks < 4) {
        return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
    else if (diffMonths < 12) {
        return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    }
    else {
        return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
    }
}
export function Providers() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [items, setItems] = React.useState([]);
    const [now, setNow] = React.useState(new Date());
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
    // Update relative times every minute
    React.useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Providers" }), _jsx("p", { className: "text-muted-foreground mt-2 text-sm", children: "A provider is an ingestor configuration + its artifacts (mappings, integrations, backfill/upload, tasks, and run state)." })] }), _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" })] }), error ? (_jsx("div", { className: "rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-600", children: error })) : null, _jsx(Card, { title: `Providers (${items.length})`, description: "Configured from schema/metrics/ingestors/*.yaml", children: loading ? (_jsx("div", { className: "py-8 text-center text-sm text-muted-foreground", children: "Loading\u2026" })) : items.length === 0 ? (_jsx("div", { className: "py-8 text-center text-sm text-muted-foreground", children: "No providers configured." })) : (_jsx("div", { className: "space-y-4", children: items.map((p) => (_jsx("div", { className: "group relative rounded-lg border bg-hit-surface border-hit-border p-5 transition-all hover:shadow-md hover:border-hit-strong", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "mb-2", children: [_jsx("h3", { className: "text-base font-semibold", children: p.label }), p.description && (_jsx("p", { className: "mt-1 text-sm text-muted-foreground leading-relaxed", children: p.description }))] }), _jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: p.uploadEnabled ? 'text-green-500' : 'text-muted-foreground', children: "\u25CF" }), p.uploadEnabled ? 'Upload' : 'No upload'] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: p.backfillEnabled ? 'text-green-500' : 'text-muted-foreground', children: "\u25CF" }), p.backfillEnabled ? 'Backfill' : 'No backfill'] }), _jsxs("span", { children: ["files: ", p.backfillFilesCount] }), p.backfillTaskName && _jsxs("span", { children: ["task: ", p.backfillTaskName] }), p.syncTaskName && _jsxs("span", { children: ["sync: ", p.syncTaskName] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [badgeFor(p.preflight.mappingOk, 'Mappings OK', `Missing ${p.preflight.mappingMissingCount ?? 0} mappings`, 'Mappings —'), p.preflight.integrationPartnerId
                                                    ? badgeFor(p.preflight.integrationOk, 'Integration OK', `Missing integration (${(p.preflight.integrationMissingFields || []).join(', ') || 'required fields'})`, 'Integration —')
                                                    : _jsx(Badge, { variant: "default", children: "No integration" }), p.stats.dataSourcesCount !== null && (_jsxs(Badge, { variant: "default", children: [p.stats.dataSourcesCount, " sources"] })), _jsxs(Badge, { variant: "default", children: [p.metricsCount, " metrics"] }), p.stats.pointsCount !== null ? (_jsxs(Badge, { variant: "info", children: [p.stats.pointsCount, " points"] })) : (_jsx(Badge, { variant: "default", children: "Points \u2014" })), p.stats.lastPointDate && (_jsxs(Badge, { variant: "default", children: ["Last: ", formatTimeAgo(p.stats.lastPointDate)] }))] })] }), _jsx("div", { className: "flex-shrink-0", children: _jsx(Button, { variant: "secondary", size: "sm", onClick: () => (window.location.href = `/metrics/providers/${encodeURIComponent(p.id)}`), className: "transition-opacity group-hover:opacity-100", children: "Open" }) })] }) }, p.id))) })) })] }));
}
export default Providers;
