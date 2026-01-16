'use client';
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { Badge } from '@hit/ui-kit/components/Badge';
import { Button } from '@hit/ui-kit/components/Button';
import { Card } from '@hit/ui-kit/components/Card';
import { ChevronDown, ChevronRight } from 'lucide-react';
export function ProviderDetail() {
    const [id, setId] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [data, setData] = React.useState(null);
    const fmtUsd = React.useMemo(() => new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }), []);
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
            const res = await fetch(`/api/metrics/providers/${encodeURIComponent(id)}`, { method: 'GET' });
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
    }, [id]);
    const provider = data?.provider;
    const artifacts = data?.artifacts;
    const mappingOk = artifacts ? artifacts.mappingMissing.length === 0 : null;
    const backfillTask = artifacts?.tasks?.backfill || null;
    const syncTask = artifacts?.tasks?.sync || null;
    const linkedProjects = artifacts?.linkedProjects || [];
    // Task execution via UI is not supported in the TypeScript-only architecture.
    // Tasks are executed via the job worker or CLI tools.
    const runningTaskName = null;
    const lastTriggeredExecutionId = null;
    async function runTask(task) {
        // Keep the UI button but steer users to the correct workflow.
        setError(`Task execution from the UI is not supported. Run this command from your terminal:\n${task.command}`);
        try {
            await navigator.clipboard.writeText(task.command);
        }
        catch {
            // ignore
        }
    }
    const targetsPreviewEnabled = !!provider?.targets_preview;
    const [targetsPreview, setTargetsPreview] = React.useState(null);
    const [targetsPreviewLoading, setTargetsPreviewLoading] = React.useState(false);
    const [targetsPreviewError, setTargetsPreviewError] = React.useState(null);
    const [artifactsExpanded, setArtifactsExpanded] = React.useState(false);
    async function loadTargetsPreview() {
        if (!id || !targetsPreviewEnabled) {
            setTargetsPreview(null);
            return;
        }
        setTargetsPreviewLoading(true);
        setTargetsPreviewError(null);
        try {
            // scanLimit: high enough for accurate-ish counts; limit: keep UI snappy
            const res = await fetch(`/api/metrics/providers/${encodeURIComponent(id)}/targets?scanLimit=2000&limit=50`, { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to load targets preview');
            setTargetsPreview(json);
        }
        catch (e) {
            setTargetsPreviewError(e instanceof Error ? e.message : 'Failed to load targets preview');
            setTargetsPreview(null);
        }
        finally {
            setTargetsPreviewLoading(false);
        }
    }
    React.useEffect(() => {
        void loadTargetsPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, targetsPreviewEnabled]);
    // Upload UI (merged from IngestorDetail)
    const [file, setFile] = React.useState(null);
    const [overwrite, setOverwrite] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [uploadResult, setUploadResult] = React.useState(null);
    async function upload() {
        if (!file || !id)
            return;
        try {
            setUploading(true);
            setError(null);
            setUploadResult(null);
            const form = new FormData();
            form.append('file', file);
            form.append('overwrite', overwrite ? 'true' : 'false');
            const res = await fetch(`/api/metrics/ingestors/${encodeURIComponent(id)}/upload`, {
                method: 'POST',
                body: form,
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || `Upload failed: ${res.status}`);
            setUploadResult(json);
            // Refresh provider detail so stats/totals update immediately.
            await load();
            await loadTargetsPreview();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        }
        finally {
            setUploading(false);
        }
    }
    function downloadTargetsCsv() {
        if (!targetsPreview?.columns || !targetsPreview?.rows)
            return;
        const cols = targetsPreview.columns;
        const rows = targetsPreview.rows;
        function esc(v) {
            if (v === null || v === undefined)
                return '';
            const s = typeof v === 'string' ? v : JSON.stringify(v);
            // escape CSV: wrap in quotes if needed, double quotes inside
            if (/[,"\n]/.test(s))
                return `"${s.replace(/"/g, '""')}"`;
            return s;
        }
        const header = cols.map((c) => esc(c.label || c.key)).join(',');
        const body = rows
            .map((r) => cols.map((c) => esc(r[c.key])).join(','))
            .join('\n');
        const csv = `${header}\n${body}\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `provider-${id}-targets.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-2xl font-bold", children: ["Provider: ", provider?.label || id || '—'] }), _jsx("p", { className: "text-muted-foreground", children: provider?.description || id })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => (window.location.href = '/metrics/providers'), children: "Back" }), _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" })] })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: "Preflight", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !artifacts ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No data." })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [mappingOk === null ? (_jsx(Badge, { variant: "default", children: "Mappings \u2014" })) : mappingOk ? (_jsx(Badge, { variant: "success", children: "Mappings OK" })) : (_jsxs(Badge, { variant: "error", children: ["Missing ", artifacts.mappingMissing.length, " mappings"] })), artifacts.integration ? (artifacts.integration.configured && artifacts.integration.enabled && artifacts.integration.missingFields.length === 0 ? (_jsx(Badge, { variant: "success", children: "Integration OK" })) : (_jsxs(Badge, { variant: "error", children: ["Integration missing (", artifacts.integration.missingFields.join(', ') || 'required', ")"] }))) : (_jsx(Badge, { variant: "default", children: "No integration" })), artifacts.stats ? _jsxs(Badge, { variant: "info", children: [artifacts.stats.pointsCount, " points"] }) : _jsx(Badge, { variant: "default", children: "Points \u2014" }), artifacts.stats?.lastPointDate ? _jsxs(Badge, { variant: "default", children: ["Last point: ", artifacts.stats.lastPointDate] }) : null, targetsPreviewEnabled ? (targetsPreviewLoading ? (_jsx(Badge, { variant: "default", children: "Targets\u2026" })) : targetsPreview?.meta ? (_jsxs(Badge, { variant: "default", children: ["Targets: ", targetsPreview.meta.filtered, targetsPreview.meta.truncatedScan ? '+' : ''] })) : (_jsx(Badge, { variant: "default", children: "Targets: \u2014" }))) : null] }), artifacts.mappingMissing.length > 0 ? (_jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium mb-1", children: "Missing mappings (first 50):" }), _jsx("pre", { className: "text-xs overflow-auto", children: artifacts.mappingMissing.slice(0, 50).join('\n') }), artifacts.mapping?.linkType ? (_jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => (window.location.href = `/metrics/mappings/${encodeURIComponent(artifacts.mapping.linkType)}`), children: ["Open mappings (", artifacts.mapping.linkType, ")"] }) })) : null] })) : null] })) }), targetsPreviewEnabled ? (_jsx(Card, { title: "Targets", description: "Preview of the records this provider will process (same discovery query; no scraping).", children: targetsPreviewLoading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : targetsPreviewError ? (_jsx("div", { className: "text-sm text-red-600", children: targetsPreviewError })) : targetsPreview?.meta ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Badge, { variant: "info", children: [targetsPreview.meta.filtered, targetsPreview.meta.truncatedScan ? '+' : '', " targets"] }), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["scanned=", targetsPreview.meta.scanned, " scanLimit=", targetsPreview.meta.scanLimit, " returned=", targetsPreview.meta.returned, " limit=", targetsPreview.meta.limit] }), _jsx("div", { className: "flex-1" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: downloadTargetsCsv, disabled: !targetsPreview.rows?.length, children: "Download CSV" })] }), targetsPreview.rows.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No targets found." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b text-left text-muted-foreground", children: targetsPreview.columns.map((c) => (_jsx("th", { className: "py-2 pr-4 font-medium", children: c.label || c.key }, c.key))) }) }), _jsx("tbody", { children: targetsPreview.rows.map((r, idx) => (_jsx("tr", { className: "border-b hover:bg-muted/50 transition-colors", children: targetsPreview.columns.map((c) => (_jsx("td", { className: "py-2 pr-4", children: (() => {
                                                    const v = r[c.key];
                                                    if (v === null || v === undefined)
                                                        return '—';
                                                    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
                                                        return String(v);
                                                    return JSON.stringify(v);
                                                })() }, c.key))) }, idx))) })] }) }))] })) : (_jsx("div", { className: "text-sm text-muted-foreground", children: "No targets preview configured." })) })) : null, _jsx(Card, { title: "Metrics", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !provider ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Provider not found." })) : (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "flex flex-wrap items-center gap-2", children: _jsxs(Badge, { variant: "default", children: [Array.isArray(provider.metrics) ? provider.metrics.length : 0, " metrics"] }) }), Array.isArray(provider.metrics) && provider.metrics.length > 0 ? (_jsxs("details", { children: [_jsx("summary", { className: "text-sm cursor-pointer", children: "Show metric keys" }), _jsx("pre", { className: "text-xs overflow-auto mt-2", children: provider.metrics.join('\n') })] })) : (_jsx("div", { className: "text-sm text-muted-foreground", children: "No metric keys declared on this provider." }))] })) }), linkedProjects.length > 0 ? (_jsx(Card, { title: "Linked projects (file \u2192 project)", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : (_jsx("div", { className: "space-y-3", children: _jsx("div", { className: "space-y-2", children: linkedProjects.map((p) => (_jsxs("div", { className: "border rounded-md p-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "info", children: p.projectSlug || p.projectId }), _jsx("code", { className: "text-xs bg-muted px-1.5 py-0.5 rounded font-mono", children: p.projectId })] }), _jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["Steam app ids (from CSV dims): ", p.steamAppIds.map((x) => `${x.steamAppId}${x.group ? ` (${x.group})` : ''}`).join(', ') || '—'] }), _jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: ["Files: ", p.fileNames.length] }), p.totals ? (_jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["Revenue (all-time): gross=", fmtUsd.format(p.totals.grossRevenueUsd || 0), " \u00B7 net=", fmtUsd.format(p.totals.netRevenueUsd || 0)] })) : null] }, p.projectId))) }) })) })) : null, _jsx(Card, { title: "Backfill task", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !backfillTask ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No backfill task found in hit.yaml for this provider." })) : (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "info", children: backfillTask.name }), _jsx(Button, { variant: "primary", size: "sm", disabled: runningTaskName === backfillTask.name, onClick: () => runTask(backfillTask), children: runningTaskName === backfillTask.name ? 'Running…' : 'Run' }), _jsx(Button, { variant: "secondary", size: "sm", onClick: async () => {
                                        try {
                                            await navigator.clipboard.writeText(backfillTask.command);
                                        }
                                        catch {
                                            // ignore
                                        }
                                    }, children: "Copy command" })] }), _jsx("pre", { className: "text-xs overflow-auto", children: backfillTask.command }), backfillTask.cron ? _jsxs("div", { className: "text-xs text-muted-foreground", children: ["Cron: ", backfillTask.cron] }) : null, lastTriggeredExecutionId && runningTaskName === null ? (_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Triggered execution: ", _jsx("code", { className: "text-xs bg-muted px-1.5 py-0.5 rounded font-mono", children: lastTriggeredExecutionId })] })) : null, backfillTask.description ? _jsx("div", { className: "text-sm text-muted-foreground", children: backfillTask.description }) : null, _jsx("div", { className: "text-xs text-muted-foreground", children: "Runs through the Tasks system (same as the Jobs/Tasks page)." })] })) }), _jsx(Card, { title: "Sync task", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !syncTask ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No sync task found/configured for this provider." })) : (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Badge, { variant: "info", children: syncTask.name }), _jsx(Button, { variant: "primary", size: "sm", disabled: runningTaskName === syncTask.name, onClick: () => runTask(syncTask), children: runningTaskName === syncTask.name ? 'Running…' : 'Run' }), _jsx(Button, { variant: "secondary", size: "sm", onClick: async () => {
                                        try {
                                            await navigator.clipboard.writeText(syncTask.command);
                                        }
                                        catch {
                                            // ignore
                                        }
                                    }, children: "Copy command" })] }), _jsx("pre", { className: "text-xs overflow-auto", children: syncTask.command }), syncTask.cron ? _jsxs("div", { className: "text-xs text-muted-foreground", children: ["Cron: ", syncTask.cron] }) : null, lastTriggeredExecutionId && runningTaskName === null ? (_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Triggered execution: ", _jsx("code", { className: "text-xs bg-muted px-1.5 py-0.5 rounded font-mono", children: lastTriggeredExecutionId })] })) : null, syncTask.description ? _jsx("div", { className: "text-sm text-muted-foreground", children: syncTask.description }) : null] })) }), _jsxs(Card, { children: [_jsxs("button", { onClick: () => setArtifactsExpanded(!artifactsExpanded), className: "flex items-center gap-2 mb-3 text-left text-2xl font-bold", children: [artifactsExpanded ? (_jsx(ChevronDown, { className: "w-4 h-4" })) : (_jsx(ChevronRight, { className: "w-4 h-4" })), _jsx("span", { children: "Artifacts" })] }), artifactsExpanded ? (loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !provider ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Provider not found." })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium", children: "Backfill" }), _jsxs("div", { className: "text-muted-foreground", children: [provider?.backfill?.enabled ? 'enabled' : 'disabled', " \u00B7 kind: ", provider?.backfill?.kind || '—', " \u00B7 dir:", ' ', provider?.backfill?.dir || '—', " \u00B7 pattern: ", provider?.backfill?.pattern || '—'] }), artifacts ? (_jsxs("div", { className: "text-muted-foreground", children: ["Files detected: ", artifacts.backfillFiles.length] })) : null] }), _jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium", children: "Upload" }), _jsx("div", { className: "text-muted-foreground", children: provider?.upload?.enabled ? 'enabled' : 'disabled' })] }), _jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "font-medium", children: "Config" }), _jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(provider, null, 2) })] })] }))) : null] }), _jsx(Card, { title: "Upload & ingest", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : !provider?.upload?.enabled ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Upload is disabled for this provider." })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("input", { type: "file", accept: ".csv,text/csv", onChange: (e) => setFile(e.target.files?.[0] || null) }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: overwrite, onChange: (e) => setOverwrite(e.target.checked) }), "Overwrite existing batch even if it\u2019s larger/equal"] }), _jsx(Button, { variant: "primary", onClick: () => upload(), disabled: !file || uploading, children: uploading ? 'Uploading…' : 'Upload & Ingest' }), uploadResult ? _jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(uploadResult, null, 2) }) : null] })) })] }));
}
export default ProviderDetail;
