'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button } from '@hit/ui-kit/components/Button';
import { Card } from '@hit/ui-kit/components/Card';
export function Dashboard() {
    const [defsCount, setDefsCount] = React.useState(null);
    const [dataSourcesCount, setDataSourcesCount] = React.useState(null);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                setError(null);
                const [defsRes, dsRes] = await Promise.all([
                    fetch('/api/metrics/definitions'),
                    fetch('/api/metrics/data-sources'),
                ]);
                if (!defsRes.ok)
                    throw new Error(`Failed to load metric definitions: ${defsRes.status}`);
                if (!dsRes.ok)
                    throw new Error(`Failed to load data sources: ${dsRes.status}`);
                const defsJson = (await defsRes.json());
                const dsJson = (await dsRes.json());
                if (!cancelled) {
                    setDefsCount(Array.isArray(defsJson.data) ? defsJson.data.length : 0);
                    setDataSourcesCount(Array.isArray(dsJson.data) ? dsJson.data.length : 0);
                }
            }
            catch (e) {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : String(e));
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Metrics" }), _jsx("p", { className: "text-muted-foreground", children: "Core metrics system: definitions, data sources, ingestion, and fast aggregation queries." })] }), _jsx("div", { className: "flex gap-2", children: _jsx(Button, { variant: "secondary", onClick: () => (window.location.href = '/admin/jobs'), children: "Jobs Admin" }) })] }), error ? (_jsx("div", { className: "text-sm text-red-600", children: error })) : null, _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Card, { title: "Metric Definitions", description: "Registered metric keys available for ingestion/query.", children: _jsx("div", { className: "text-3xl font-bold", children: defsCount ?? '—' }) }), _jsx(Card, { title: "Data Sources", description: "Enabled connectors/configs that produce points.", children: _jsx("div", { className: "text-3xl font-bold", children: dataSourcesCount ?? '—' }) })] })] }));
}
export default Dashboard;
