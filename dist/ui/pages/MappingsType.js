import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { AlertDialog } from '@hit/ui-kit/components/AlertDialog';
import { useAlertDialog } from '@hit/ui-kit/hooks/useAlertDialog';
function parseHashEditId() {
    const h = window.location.hash || '';
    const m = h.match(/edit=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
}
export function MappingsType(props) {
    const { Page, Card, Button, Input, TextArea, Table } = useUi();
    const alert = useAlertDialog();
    const type = props.type;
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState(null);
    const [linkId, setLinkId] = useState('');
    const [metadata, setMetadata] = useState('{\n  "steam_app_id": ""\n}');
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const navigate = (path) => {
        if (props.onNavigate)
            props.onNavigate(path);
        else
            window.location.href = path;
    };
    async function load() {
        if (!type)
            return;
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/metrics/links', window.location.origin);
            url.searchParams.set('linkType', type);
            url.searchParams.set('limit', '500');
            const res = await fetch(url.toString(), { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to load mappings');
            const data = Array.isArray(json?.data) ? json.data : [];
            setRows(data);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load mappings');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const idx = parts.indexOf('mappings');
        const t = idx >= 0 ? parts[idx + 1] : '';
        // If router didn't pass props, fall back to parsing URL
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        t;
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const id = parseHashEditId();
        if (!id)
            return;
        const row = rows.find((r) => r.id === id);
        if (!row)
            return;
        setEditingId(row.id);
        setLinkId(row.linkId);
        setMetadata(JSON.stringify(row.metadata ?? {}, null, 2));
    }, [rows]);
    const title = useMemo(() => `Mappings: ${type || '—'}`, [type]);
    async function save() {
        if (!type)
            return;
        if (!linkId.trim()) {
            setError('Missing linkId');
            return;
        }
        let parsed = null;
        if (metadata.trim()) {
            try {
                parsed = JSON.parse(metadata);
            }
            catch {
                setError('Metadata must be valid JSON');
                return;
            }
        }
        setSaving(true);
        setError(null);
        try {
            if (editingId) {
                const res = await fetch(`/api/metrics/links/${encodeURIComponent(editingId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        linkType: type,
                        linkId: linkId.trim(),
                        targetKind: 'none',
                        targetId: '',
                        metadata: parsed,
                    }),
                });
                const json = (await res.json().catch(() => null));
                if (!res.ok)
                    throw new Error(json?.error || 'Failed to update');
            }
            else {
                const res = await fetch('/api/metrics/links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        linkType: type,
                        linkId: linkId.trim(),
                        targetKind: 'none',
                        targetId: '',
                        metadata: parsed,
                    }),
                });
                const json = (await res.json().catch(() => null));
                if (!res.ok)
                    throw new Error(json?.error || 'Failed to create');
            }
            setEditingId(null);
            setLinkId('');
            setMetadata(type === 'metrics.field_mapper' ? '{\n  "steam_app_id": ""\n}' : '{\n}');
            window.location.hash = '';
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
        }
        finally {
            setSaving(false);
        }
    }
    async function remove(row) {
        const ok = await alert.showConfirm(`Delete mapping "${row.linkId}"?`, {
            title: 'Delete mapping',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'error',
        });
        if (!ok)
            return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/metrics/links/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to delete');
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx(AlertDialog, { ...alert.props }), _jsxs(Page, { title: title, description: "Add/edit/delete mappings in metrics_links for this type.", actions: _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx(Button, { variant: "secondary", onClick: () => navigate('/metrics/mappings'), children: "Back" }), _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" })] }), children: [_jsxs(Card, { title: editingId ? 'Edit mapping' : 'Add mapping', children: [error ? _jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }, children: error }) : null, _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [_jsx(Input, { label: "Link ID", value: linkId, onChange: setLinkId, placeholder: type === 'metrics.field_mapper' ? 'Aquamarine - Sales Data.csv' : 'identifier', disabled: saving }), _jsx(TextArea, { label: "Metadata (JSON)", value: metadata, onChange: setMetadata, rows: 7, disabled: saving }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx(Button, { variant: "primary", onClick: save, disabled: saving || !linkId.trim(), children: saving ? 'Saving…' : editingId ? 'Save' : 'Create' }), editingId ? (_jsx(Button, { variant: "secondary", onClick: () => {
                                                    setEditingId(null);
                                                    setLinkId('');
                                                    setMetadata(type === 'metrics.field_mapper' ? '{\n  "steam_app_id": ""\n}' : '{\n}');
                                                    window.location.hash = '';
                                                }, disabled: saving, children: "Cancel" })) : null] })] })] }), _jsx(Card, { title: "Existing mappings", children: _jsx(Table, { loading: loading, emptyMessage: "No mappings yet.", columns: [
                                { key: 'linkId', label: 'Link ID' },
                                { key: 'steam', label: 'steam_app_id' },
                                { key: 'updated', label: 'Updated' },
                                { key: 'actions', label: '' },
                            ], data: rows.map((r) => ({
                                linkId: r.linkId,
                                steam: type === 'metrics.field_mapper' ? String(r?.metadata?.steam_app_id || '') : '—',
                                updated: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—',
                                actions: (_jsxs("div", { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => {
                                                window.location.hash = `edit=${encodeURIComponent(r.id)}`;
                                                setEditingId(r.id);
                                                setLinkId(r.linkId);
                                                setMetadata(JSON.stringify(r.metadata ?? {}, null, 2));
                                            }, children: "Edit" }), _jsx(Button, { variant: "danger", size: "sm", onClick: () => remove(r), disabled: saving, children: "Delete" })] })),
                            })) }) })] })] }));
}
export default MappingsType;
