'use client';
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { Button, Card } from '@hit/ui-kit';
export function IngestorDetail() {
    const [ingestorId, setIngestorId] = React.useState('');
    const [ing, setIng] = React.useState(null);
    const [file, setFile] = React.useState(null);
    const [overwrite, setOverwrite] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [uploading, setUploading] = React.useState(false);
    React.useEffect(() => {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const idx = parts.indexOf('ingestors');
        const id = idx >= 0 ? parts[idx + 1] : '';
        setIngestorId(id || '');
    }, []);
    async function refresh() {
        try {
            setLoading(true);
            setError(null);
            setResult(null);
            const res = await fetch('/api/metrics/ingestors');
            if (!res.ok)
                throw new Error(`Failed to load ingestors: ${res.status}`);
            const json = (await res.json());
            const list = Array.isArray(json.ingestors) ? json.ingestors : [];
            const found = list.find((x) => x.id === ingestorId) || null;
            setIng(found);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }
    React.useEffect(() => {
        if (!ingestorId)
            return;
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ingestorId]);
    async function upload() {
        if (!file || !ingestorId)
            return;
        try {
            setUploading(true);
            setError(null);
            setResult(null);
            const form = new FormData();
            form.append('file', file);
            form.append('overwrite', overwrite ? 'true' : 'false');
            const res = await fetch(`/api/metrics/ingestors/${encodeURIComponent(ingestorId)}/upload`, {
                method: 'POST',
                body: form,
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || `Upload failed: ${res.status}`);
            setResult(json);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setUploading(false);
        }
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-2xl font-bold", children: ["Ingestor: ", ingestorId || '—'] }), _jsxs("p", { className: "text-muted-foreground", children: ["Dynamic ingestion configured in ", _jsx("code", { children: ".hit/metrics/ingestors" }), "."] })] }), _jsx(Button, { variant: "secondary", onClick: () => (window.location.href = '/metrics/ingestors'), children: "Back" })] }), error ? _jsx("div", { className: "text-sm text-red-600", children: error }) : null, _jsx(Card, { title: "Config", children: loading ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Loading\u2026" })) : ing ? (_jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(ing, null, 2) })) : (_jsx("div", { className: "text-sm text-muted-foreground", children: "Ingestor not found." })) }), _jsx(Card, { title: "Upload", children: !ing?.upload?.enabled ? (_jsx("div", { className: "text-sm text-muted-foreground", children: "Upload is disabled for this ingestor." })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("input", { type: "file", accept: ".csv,text/csv", onChange: (e) => setFile(e.target.files?.[0] || null) }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: overwrite, onChange: (e) => setOverwrite(e.target.checked) }), "Overwrite existing batch even if it\u2019s larger/equal"] }), _jsx(Button, { variant: "primary", onClick: () => upload(), disabled: !file || uploading, children: uploading ? 'Uploading…' : 'Upload & Ingest' })] })) }), result ? (_jsx(Card, { title: "Result", children: _jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(result, null, 2) }) })) : null] }));
}
export default IngestorDetail;
