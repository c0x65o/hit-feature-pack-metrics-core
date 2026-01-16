'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button } from '@hit/ui-kit/components/Button';
import { Card } from '@hit/ui-kit/components/Card';
import { ChevronDown, ChevronRight } from 'lucide-react';
function SourceChip(props) {
    const owner = props.owner;
    const kind = owner?.kind;
    const className = kind === 'feature_pack'
        ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
        : kind === 'app'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : kind === 'user'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-muted text-muted-foreground';
    const text = kind === 'feature_pack'
        ? `fp:${owner?.id ?? 'unknown'}`
        : kind === 'app'
            ? 'app'
            : kind === 'user'
                ? 'user'
                : '—';
    return _jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`, children: text });
}
function sourceKey(owner) {
    if (owner?.kind === 'feature_pack')
        return `fp:${owner.id}`;
    if (owner?.kind === 'app')
        return 'app';
    if (owner?.kind === 'user')
        return 'user';
    return '—';
}
function sourceLabel(owner) {
    if (owner?.kind === 'feature_pack')
        return `Feature pack: ${owner.id}`;
    if (owner?.kind === 'app')
        return 'App';
    if (owner?.kind === 'user')
        return `User: ${owner.id}`;
    return '—';
}
function formatTimeAgo(dateString) {
    if (!dateString)
        return '—';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime()))
            return '—';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffSeconds < 60)
            return 'just now';
        if (diffMinutes < 60)
            return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        if (diffHours < 24)
            return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        if (diffDays < 7)
            return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        // For older dates, show the date
        return date.toLocaleDateString();
    }
    catch {
        return '—';
    }
}
export function Definitions() {
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [message, setMessage] = React.useState(null);
    const [selectedSources, setSelectedSources] = React.useState(new Set());
    const [groupedView, setGroupedView] = React.useState(true);
    const [expandedGroups, setExpandedGroups] = React.useState(new Set());
    async function refresh() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/metrics/catalog');
            if (!res.ok)
                throw new Error(`Failed to load: ${res.status}`);
            const json = (await res.json());
            const loadedItems = Array.isArray(json.items) ? json.items : [];
            setItems(loadedItems);
            setMessage(typeof json.message === 'string' ? json.message : null);
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
    // Initialize selected sources with all available sources when items are first loaded
    React.useEffect(() => {
        if (items.length > 0 && selectedSources.size === 0) {
            const allSources = new Set();
            for (const item of items) {
                const source = sourceKey(item.owner);
                allSources.add(source);
            }
            setSelectedSources(allSources);
        }
    }, [items, selectedSources.size]);
    // Extract unique sources from items
    const availableSources = React.useMemo(() => {
        const sources = new Set();
        for (const item of items) {
            const source = sourceKey(item.owner);
            sources.add(source);
        }
        return Array.from(sources).sort();
    }, [items]);
    // Filter items based on selected sources
    const filteredItems = React.useMemo(() => {
        if (selectedSources.size === 0)
            return items;
        return items.filter((item) => {
            const source = sourceKey(item.owner);
            return selectedSources.has(source);
        });
    }, [items, selectedSources]);
    function toggleSource(source) {
        setSelectedSources((prev) => {
            const next = new Set(prev);
            if (next.has(source)) {
                next.delete(source);
            }
            else {
                next.add(source);
            }
            return next;
        });
    }
    const groupedItems = React.useMemo(() => {
        const groups = new Map();
        for (const it of filteredItems) {
            const k = sourceKey(it.owner);
            const g = groups.get(k) || { key: k, owner: it.owner, items: [], pointsSum: 0 };
            // Prefer first non-empty owner metadata
            if (!g.owner && it.owner)
                g.owner = it.owner;
            g.items.push(it);
            g.pointsSum += Number(it.pointsCount || 0) || 0;
            groups.set(k, g);
        }
        const out = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
        for (const g of out)
            g.items.sort((a, b) => a.key.localeCompare(b.key));
        return out;
    }, [filteredItems]);
    function toggleGroup(k) {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(k))
                next.delete(k);
            else
                next.add(k);
            return next;
        });
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Metrics" }), _jsx("p", { className: "text-muted-foreground", children: "All known metrics (feature packs + app config + DB-defined), plus live data coverage from ingested points." })] }), _jsx(Button, { variant: "secondary", onClick: () => refresh(), disabled: loading, children: "Refresh" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, message ? _jsx("div", { className: "text-sm text-muted-foreground", children: message }) : null, availableSources.length > 0 && (_jsx(Card, { title: "Filter by Source", description: "Select one or more sources to filter metrics.", children: _jsx("div", { className: "flex flex-wrap gap-3", children: availableSources.map((source) => {
                        const isSelected = selectedSources.has(source);
                        const owner = items.find((item) => {
                            const itemSource = item.owner?.kind === 'feature_pack'
                                ? `fp:${item.owner.id}`
                                : item.owner?.kind === 'app'
                                    ? 'app'
                                    : item.owner?.kind === 'user'
                                        ? 'user'
                                        : '—';
                            return itemSource === source;
                        })?.owner;
                        const className = owner?.kind === 'feature_pack'
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700'
                            : owner?.kind === 'app'
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700'
                                : owner?.kind === 'user'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                                    : 'bg-muted text-muted-foreground border-muted';
                        return (_jsxs("label", { className: `inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all ${isSelected
                                ? className
                                : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'}`, children: [_jsx("input", { type: "checkbox", checked: isSelected, onChange: () => toggleSource(source), className: "w-3 h-3 rounded border-gray-300 text-current focus:ring-2 focus:ring-current" }), _jsx(SourceChip, { owner: owner })] }, source));
                    }) }) })), _jsx(Card, { title: `Configured metrics (${filteredItems.length}${filteredItems.length !== items.length ? ` of ${items.length}` : ''})`, description: "Read-only. Configure metrics via feature-pack.yaml or schema/metrics/definitions and run `hit run`.", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : filteredItems.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: items.length === 0 ? 'No definitions yet.' : 'No metrics match the selected filters.' })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Tip: this view is now grouped by source/owner to reduce noise." }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: groupedView ? 'primary' : 'secondary', onClick: () => setGroupedView(true), children: "Grouped" }), _jsx(Button, { variant: !groupedView ? 'primary' : 'secondary', onClick: () => setGroupedView(false), children: "Flat" })] })] }), groupedView ? (_jsx("div", { className: "space-y-3", children: groupedItems.map((g) => {
                                const isOpen = expandedGroups.has(g.key);
                                return (_jsxs("div", { className: "border rounded-lg", children: [_jsx("button", { type: "button", onClick: () => toggleGroup(g.key), className: "w-full flex items-center justify-between gap-3 px-4 py-3 text-left", children: _jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [isOpen ? _jsx(ChevronDown, { size: 16 }) : _jsx(ChevronRight, { size: 16 }), _jsx(SourceChip, { owner: g.owner }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: sourceLabel(g.owner) }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [g.items.length, " metric", g.items.length === 1 ? '' : 's', " \u00B7 ", g.pointsSum.toLocaleString(), " points"] })] })] }) }), isOpen ? (_jsx("div", { className: "overflow-x-auto border-t", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b text-left text-muted-foreground", children: [_jsx("th", { className: "py-3 pr-4 pl-4 font-medium", children: "Source" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Metric Key" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Label" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Unit" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Rollup" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Granularity" }), _jsx("th", { className: "py-3 pr-4 font-medium text-right", children: "Points" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "First" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Last" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Updated" })] }) }), _jsx("tbody", { children: g.items.map((d) => (_jsxs("tr", { className: "border-b hover:bg-muted/50 transition-colors", children: [_jsx("td", { className: "py-3 pr-4 pl-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(SourceChip, { owner: d.owner }), _jsx("span", { className: "text-xs text-muted-foreground", children: sourceLabel(d.owner) })] }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("code", { className: "text-xs bg-muted px-1.5 py-0.5 rounded font-mono", children: d.key }) }), _jsx("td", { className: "py-3 pr-4 font-medium", children: d.label }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: "inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", children: d.unit }) }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground", children: d.rollup_strategy || '—' }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground", children: d.time_kind === 'realtime' ? (_jsx("span", { className: "inline-flex items-center rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300", children: "realtime" })) : d.time_kind === 'none' ? (_jsx("span", { className: "inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300", children: "n/a" })) : d.default_granularity ? (_jsxs("span", { className: "inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300", children: [d.default_granularity, Array.isArray(d.allowed_granularities) && d.allowed_granularities.length > 0 ? (_jsxs("span", { className: "ml-1 text-slate-500 dark:text-slate-400", children: ["(", d.allowed_granularities.join(','), ")"] })) : null] })) : ('—') }), _jsx("td", { className: "py-3 pr-4 text-right tabular-nums", children: d.time_kind === 'realtime' ? (_jsx("span", { className: "text-muted-foreground", children: "\u2014" })) : d.pointsCount > 0 ? (_jsx("span", { className: "text-green-600 dark:text-green-400 font-medium", children: d.pointsCount.toLocaleString() })) : (_jsx("span", { className: "text-muted-foreground", children: "0" })) }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground tabular-nums", children: d.time_kind === 'realtime' ? '—' : d.firstPointAt ? new Date(d.firstPointAt).toLocaleDateString() : '—' }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground tabular-nums", children: d.time_kind === 'realtime' ? '—' : d.lastPointAt ? new Date(d.lastPointAt).toLocaleDateString() : '—' }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground tabular-nums", children: d.time_kind === 'realtime' ? '—' : formatTimeAgo(d.lastUpdatedAt) })] }, d.key))) })] }) })) : null] }, g.key));
                            }) })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b text-left text-muted-foreground", children: [_jsx("th", { className: "py-3 pr-4 font-medium", children: "Source" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Metric Key" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Label" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Unit" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Rollup" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Granularity" }), _jsx("th", { className: "py-3 pr-4 font-medium text-right", children: "Points" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "First" }), _jsx("th", { className: "py-3 pr-4 font-medium", children: "Last" }), _jsx("th", { className: "py-3 font-medium", children: "Updated" })] }) }), _jsx("tbody", { children: filteredItems
                                            .slice()
                                            .sort((a, b) => a.key.localeCompare(b.key))
                                            .map((d) => (_jsxs("tr", { className: "border-b hover:bg-muted/50 transition-colors", children: [_jsx("td", { className: "py-3 pr-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(SourceChip, { owner: d.owner }), _jsx("span", { className: "text-xs text-muted-foreground", children: sourceLabel(d.owner) })] }) }), _jsx("td", { className: "py-3 pr-4", children: _jsx("code", { className: "text-xs bg-muted px-1.5 py-0.5 rounded font-mono", children: d.key }) }), _jsx("td", { className: "py-3 pr-4 font-medium", children: d.label }), _jsx("td", { className: "py-3 pr-4", children: _jsx("span", { className: "inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", children: d.unit }) }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground", children: d.rollup_strategy || '—' }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground", children: d.time_kind === 'realtime' ? (_jsx("span", { className: "inline-flex items-center rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300", children: "realtime" })) : d.time_kind === 'none' ? (_jsx("span", { className: "inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300", children: "n/a" })) : d.default_granularity ? (_jsxs("span", { className: "inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300", children: [d.default_granularity, Array.isArray(d.allowed_granularities) && d.allowed_granularities.length > 0 ? (_jsxs("span", { className: "ml-1 text-slate-500 dark:text-slate-400", children: ["(", d.allowed_granularities.join(','), ")"] })) : null] })) : ('—') }), _jsx("td", { className: "py-3 pr-4 text-right tabular-nums", children: d.time_kind === 'realtime' ? (_jsx("span", { className: "text-muted-foreground", children: "\u2014" })) : d.pointsCount > 0 ? (_jsx("span", { className: "text-green-600 dark:text-green-400 font-medium", children: d.pointsCount.toLocaleString() })) : (_jsx("span", { className: "text-muted-foreground", children: "0" })) }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground tabular-nums", children: d.time_kind === 'realtime' ? '—' : d.firstPointAt ? new Date(d.firstPointAt).toLocaleDateString() : '—' }), _jsx("td", { className: "py-3 pr-4 text-muted-foreground tabular-nums", children: d.time_kind === 'realtime' ? '—' : d.lastPointAt ? new Date(d.lastPointAt).toLocaleDateString() : '—' }), _jsx("td", { className: "py-3 text-muted-foreground tabular-nums", children: d.time_kind === 'realtime' ? '—' : formatTimeAgo(d.lastUpdatedAt) })] }, d.key))) })] }) }))] })) })] }));
}
export default Definitions;
