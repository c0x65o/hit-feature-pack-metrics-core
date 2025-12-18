'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button, Card, Input } from '@hit/ui-kit';
export function SteamSalesUpload() {
    const [file, setFile] = React.useState(null);
    const [entityKind, setEntityKind] = React.useState('org');
    const [entityId, setEntityId] = React.useState('hitcents');
    const [dataSourceId, setDataSourceId] = React.useState('ds_steam_sales_files');
    const [overwrite, setOverwrite] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    async function upload() {
        if (!file)
            return;
        try {
            setLoading(true);
            setError(null);
            setResult(null);
            const form = new FormData();
            form.append('file', file);
            form.append('entityKind', entityKind);
            form.append('entityId', entityId);
            form.append('dataSourceId', dataSourceId);
            form.append('overwrite', overwrite ? 'true' : 'false');
            const res = await fetch('/api/metrics/uploads/steam-sales', { method: 'POST', body: form });
            const json = (await res.json().catch(() => null));
            if (!res.ok) {
                throw new Error(json?.error || `Upload failed: ${res.status}`);
            }
            setResult(json);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Steam Sales Upload" }), _jsx("p", { className: "text-muted-foreground", children: "Upload monthly Steam sales CSV exports (daily rows). We map filename \u2192 Steam App ID and ingest points into metrics-core." })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: "Upload", description: "Overlap policy: keep the larger file for the same date range (unless overwrite=true).", children: _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("input", { type: "file", accept: ".csv,text/csv", onChange: (e) => setFile(e.target.files?.[0] || null), disabled: loading }), _jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: ["Expected: ", _jsx("code", { children: "* - Sales Data.csv" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [_jsx(Input, { label: "Entity kind", value: entityKind, onChange: setEntityKind }), _jsx(Input, { label: "Entity id", value: entityId, onChange: setEntityId }), _jsx(Input, { label: "Data source id", value: dataSourceId, onChange: setDataSourceId })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: overwrite, onChange: (e) => setOverwrite(e.target.checked), disabled: loading }), "Overwrite existing batch even if it\u2019s larger/equal"] }), _jsx(Button, { variant: "primary", onClick: () => upload(), disabled: !file || loading, children: loading ? 'Uploading…' : 'Upload & Ingest' })] }) }), result ? (_jsx(Card, { title: "Result", children: _jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(result, null, 2) }) })) : null] }));
}
export default SteamSalesUpload;
