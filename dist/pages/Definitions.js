'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button, Card, Input } from '@hit/ui-kit';
export function Definitions() {
    const [defs, setDefs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [key, setKey] = React.useState('');
    const [label, setLabel] = React.useState('');
    const [unit, setUnit] = React.useState('count');
    async function refresh() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/metrics/definitions');
            if (!res.ok)
                throw new Error(`Failed to load: ${res.status}`);
            const json = (await res.json());
            setDefs(Array.isArray(json.data) ? json.data : []);
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
    async function create() {
        try {
            setError(null);
            const res = await fetch('/api/metrics/definitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, label, unit }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || `Create failed: ${res.status}`);
            }
            setKey('');
            setLabel('');
            setUnit('count');
            await refresh();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Metric Definitions" }), _jsx("p", { className: "text-muted-foreground", children: "Define metric keys, labels, units, and rollup rules. These keys are what scripts ingest and queries request." })] }), _jsx(Button, { variant: "secondary", onClick: () => refresh(), disabled: loading, children: "Refresh" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsxs(Card, { title: "Create Definition", description: "Add a new metric key. (Auth required.)", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [_jsx(Input, { label: "Key", value: key, onChange: setKey, placeholder: "revenue_usd" }), _jsx(Input, { label: "Label", value: label, onChange: setLabel, placeholder: "Revenue (USD)" }), _jsx(Input, { label: "Unit", value: unit, onChange: setUnit, placeholder: "usd" })] }), _jsx("div", { className: "mt-3", children: _jsx(Button, { variant: "primary", onClick: () => create(), disabled: !key.trim() || !label.trim(), children: "Create" }) })] }), _jsx(Card, { title: `Definitions (${defs.length})`, description: "Current registered metric definitions.", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : defs.length === 0 ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "No definitions yet." })) : (_jsx("div", { className: "space-y-2", children: defs
                        .slice()
                        .sort((a, b) => a.key.localeCompare(b.key))
                        .map((d) => (_jsx("div", { className: "flex items-start justify-between gap-4 border-b py-2", children: _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: d.key }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [d.label, " \u00B7 ", d.unit, d.category ? ` · ${d.category}` : '', d.isActive ? '' : ' · disabled'] })] }) }, d.id))) })) })] }));
}
export default Definitions;
