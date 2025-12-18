'use client';
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { Button, Card, Badge } from '@hit/ui-kit';
export function ProviderDetail() {
    const [id, setId] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [data, setData] = React.useState(null);
    const [includeComputed, setIncludeComputed] = React.useState(false);
    React.useEffect(() => {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('providers');
        setId(idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '');
    }, []);
    async function load() {
        if (!id)
            return;
        setLoading(true);
        setError(null);
        try {
            const url = new URL(`/api/metrics/providers/${encodeURIComponent(id)}`, window.location.origin);
            if (includeComputed)
                url.searchParams.set('includeComputed', '1');
            const res = await fetch(url.toString(), { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to load provider');
            setData(json);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load provider');
        }
        finally {
            setLoading(false);
        }
    }
    React.useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, includeComputed]);
    const provider = data?.provider;
    const artifacts = data?.artifacts;
    const mappingOk = artifacts ? artifacts.mappingMissing.length === 0 : null;
    const backfillTask = artifacts?.tasks?.backfill || null;
    const syncTask = artifacts?.tasks?.sync || null;
    const linkedProjects = artifacts?.linkedProjects || [];
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-2xl font-bold", children: ["Provider: ", provider?.label || id || '—'] }), _jsx("p", { className: "text-muted-foreground", children: provider?.description || id })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => (window.location.href = '/metrics/providers'), children: "Back" }), _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" })] })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: "Preflight", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !artifacts ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No data." })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [mappingOk === null ? (_jsx(Badge, { variant: "default", children: "Mappings \u2014" })) : mappingOk ? (_jsx(Badge, { variant: "success", children: "Mappings OK" })) : (_jsxs(Badge, { variant: "error", children: ["Missing ", artifacts.mappingMissing.length, " mappings"] })), artifacts.integration ? (artifacts.integration.configured && artifacts.integration.enabled && artifacts.integration.missingFields.length === 0 ? (_jsx(Badge, { variant: "success", children: "Integration OK" })) : (_jsxs(Badge, { variant: "error", children: ["Integration missing (", artifacts.integration.missingFields.join(', ') || 'required', ")"] }))) : (_jsx(Badge, { variant: "default", children: "No integration" })), artifacts.stats ? _jsxs(Badge, { variant: "info", children: [artifacts.stats.pointsCount, " points"] }) : _jsx(Badge, { variant: "default", children: "Points \u2014" }), artifacts.stats?.lastPointDate ? _jsxs(Badge, { variant: "default", children: ["Last point: ", artifacts.stats.lastPointDate] }) : null] }), artifacts.mappingMissing.length > 0 ? (_jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium mb-1", children: "Missing mappings (first 50):" }), _jsx("pre", { className: "text-xs overflow-auto", children: artifacts.mappingMissing.slice(0, 50).join('\n') }), artifacts.mapping?.linkType ? (_jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => (window.location.href = `/metrics/mappings/${encodeURIComponent(artifacts.mapping.linkType)}`), children: ["Open mappings (", artifacts.mapping.linkType, ")"] }) })) : null] })) : null] })) }), _jsx(Card, { title: "Linked projects (steam.app \u2192 project)", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : linkedProjects.length === 0 ? (_jsxs("div", { className: "text-sm text-muted-foreground", children: ["No linked projects found. Expected ", _jsx("code", { children: "metrics_links" }), " rows with ", _jsx("code", { children: "link_type=\"steam.app\"" }), " linking steam_app_id \u2192 project."] })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => setIncludeComputed((v) => !v), disabled: loading, children: includeComputed ? 'Hide computed totals' : 'Compute totals' }), _jsx("span", { className: "text-xs text-muted-foreground", children: "Computes totals on-demand (so we don\u2019t do heavy work on every page load)." })] }), _jsx("div", { className: "space-y-2", children: linkedProjects.map((p) => (_jsxs("div", { className: "border rounded-md p-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "info", children: p.projectSlug || p.projectId }), _jsx("code", { className: "text-xs bg-muted px-1.5 py-0.5 rounded font-mono", children: p.projectId }), includeComputed ? (_jsxs(Badge, { variant: "default", children: ["revenue_usd total: ", p.computed?.revenueUsdAllTime ?? '—'] })) : null] }), _jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["Steam app ids: ", p.steamAppIds.map((x) => `${x.steamAppId}${x.group ? ` (${x.group})` : ''}`).join(', ') || '—'] }), _jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: ["Files: ", p.fileNames.length] })] }, p.projectId))) })] })) }), _jsx(Card, { title: "Backfill task", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !backfillTask ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No backfill task found in hit.yaml for this provider." })) : (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "info", children: backfillTask.name }), _jsx(Button, { variant: "secondary", size: "sm", onClick: async () => {
                                        try {
                                            await navigator.clipboard.writeText(backfillTask.command);
                                        }
                                        catch {
                                            // ignore
                                        }
                                    }, children: "Copy command" })] }), _jsx("pre", { className: "text-xs overflow-auto", children: backfillTask.command }), backfillTask.description ? _jsx("div", { className: "text-sm text-muted-foreground", children: backfillTask.description }) : null, _jsx("div", { className: "text-xs text-muted-foreground", children: "Note: there is no \u201Crun task\u201D endpoint yet, so this UI currently exposes the exact command to run." })] })) }), _jsx(Card, { title: "Sync task", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !syncTask ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No sync task found/configured for this provider." })) : (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "info", children: syncTask.name }), _jsx(Button, { variant: "secondary", size: "sm", onClick: async () => {
                                        try {
                                            await navigator.clipboard.writeText(syncTask.command);
                                        }
                                        catch {
                                            // ignore
                                        }
                                    }, children: "Copy command" })] }), _jsx("pre", { className: "text-xs overflow-auto", children: syncTask.command }), syncTask.description ? _jsx("div", { className: "text-sm text-muted-foreground", children: syncTask.description }) : null] })) }), _jsx(Card, { title: "Artifacts", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !provider ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Provider not found." })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium", children: "Backfill" }), _jsxs("div", { className: "text-muted-foreground", children: [provider?.backfill?.enabled ? 'enabled' : 'disabled', " \u00B7 kind: ", provider?.backfill?.kind || '—', " \u00B7 dir:", ' ', provider?.backfill?.dir || '—', " \u00B7 pattern: ", provider?.backfill?.pattern || '—'] }), artifacts ? (_jsxs("div", { className: "text-muted-foreground", children: ["Files detected: ", artifacts.backfillFiles.length] })) : null] }), _jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium", children: "Upload" }), _jsx("div", { className: "text-muted-foreground", children: provider?.upload?.enabled ? 'enabled' : 'disabled' }), provider?.upload?.enabled ? (_jsx("div", { className: "mt-2", children: _jsx(Button, { variant: "primary", size: "sm", onClick: () => (window.location.href = `/metrics/ingestors/${encodeURIComponent(provider.id)}`), children: "Open upload UI" }) })) : null] }), _jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium", children: "Config" }), _jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(provider, null, 2) })] })] })) })] }));
}
export default ProviderDetail;
