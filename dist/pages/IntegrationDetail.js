import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, useAlertDialog, useUi } from '@hit/ui-kit';
export function IntegrationDetail(props) {
    const { Page, Card, Button, Input, TextArea, Checkbox, Badge } = useUi();
    const alert = useAlertDialog();
    const partnerId = props.id;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [definition, setDefinition] = useState(null);
    const [credential, setCredential] = useState(null);
    const [enabled, setEnabled] = useState(true);
    const [values, setValues] = useState({});
    const [error, setError] = useState(null);
    const [showSecrets, setShowSecrets] = useState(false);
    const navigate = (path) => {
        if (props.onNavigate)
            props.onNavigate(path);
        else
            window.location.href = path;
    };
    async function load() {
        if (!partnerId)
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}`, { method: 'GET' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to load partner');
            setDefinition(json.definition);
            const cred = json.credential ?? null;
            setCredential(cred);
            setEnabled(cred?.enabled ?? true);
            const nextValues = {};
            const creds = (cred?.credentials || {});
            for (const [k, v] of Object.entries(creds)) {
                nextValues[k] = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
            }
            setValues(nextValues);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load partner');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partnerId]);
    const status = useMemo(() => {
        if (!credential)
            return { label: 'Not configured', variant: 'default' };
        if (!enabled)
            return { label: 'Disabled', variant: 'default' };
        if (credential.lastVerifyOk === true)
            return { label: 'Verified', variant: 'success' };
        if (credential.lastVerifyOk === false)
            return { label: 'Verify failed', variant: 'error' };
        return { label: 'Not verified', variant: 'default' };
    }, [credential, enabled]);
    async function save() {
        if (!partnerId || !definition)
            return;
        setSaving(true);
        setError(null);
        try {
            const credsPayload = {};
            for (const f of definition.fields) {
                const v = values[f.key] ?? '';
                if (f.type === 'number') {
                    const n = Number(v);
                    if (v.trim() !== '' && Number.isFinite(n))
                        credsPayload[f.key] = n;
                    else if (v.trim() !== '')
                        credsPayload[f.key] = v; // let server validate
                }
                else if (f.type === 'json') {
                    if (!v.trim())
                        continue;
                    try {
                        credsPayload[f.key] = JSON.parse(v);
                    }
                    catch {
                        credsPayload[f.key] = v;
                    }
                }
                else {
                    credsPayload[f.key] = v;
                }
            }
            const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled, credentials: credsPayload }),
            });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to save');
            await load();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
        }
        finally {
            setSaving(false);
        }
    }
    async function verify() {
        if (!partnerId || !definition?.verify)
            return;
        setVerifying(true);
        setError(null);
        try {
            const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}/verify`, { method: 'POST' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Verify failed');
            await alert.showAlert(json?.message || (json?.ok ? 'Verified' : 'Verify failed'), {
                title: json?.ok ? 'Verified' : 'Verify failed',
                variant: json?.ok ? 'success' : 'error',
            });
            await load();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Verify failed';
            setError(msg);
            await alert.showAlert(msg, { title: 'Verify failed', variant: 'error' });
        }
        finally {
            setVerifying(false);
        }
    }
    async function remove() {
        if (!partnerId)
            return;
        const ok = await alert.showConfirm(`Remove credentials for "${partnerId}"?`, {
            title: 'Remove credentials',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            variant: 'error',
        });
        if (!ok)
            return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}`, { method: 'DELETE' });
            const json = (await res.json().catch(() => null));
            if (!res.ok)
                throw new Error(json?.error || 'Failed to delete');
            navigate('/metrics/integrations');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete');
        }
        finally {
            setSaving(false);
        }
    }
    if (!partnerId) {
        return (_jsx(Page, { title: "Integration", children: _jsx(Card, { children: "Missing integration id" }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(AlertDialog, { ...alert.props }), _jsxs(Page, { title: definition?.label || partnerId, description: definition?.description, actions: _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx(Button, { variant: "secondary", onClick: () => navigate('/metrics/integrations'), children: "Back" }), _jsx(Button, { variant: "secondary", onClick: save, disabled: loading || saving, children: saving ? 'Saving…' : 'Save' }), definition?.verify ? (_jsx(Button, { variant: "primary", onClick: verify, disabled: loading || saving || verifying || !credential || !enabled, children: verifying ? 'Verifying…' : 'Verify' })) : null] }), children: [_jsxs(Card, { children: [error && (_jsx("div", { style: { marginBottom: '12px', color: 'var(--hit-error, #ef4444)', fontSize: '14px' }, children: error })), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }, children: [_jsx(Badge, { variant: status.variant, children: status.label }), credential?.lastVerifiedAt ? (_jsxs("span", { style: { fontSize: '13px', color: 'var(--hit-muted-foreground, #64748b)' }, children: ["Last verified: ", new Date(credential.lastVerifiedAt).toLocaleString()] })) : null, credential?.lastVerifyMessage ? (_jsx("span", { style: { fontSize: '13px', color: 'var(--hit-muted-foreground, #64748b)' }, children: credential.lastVerifyMessage })) : null] }), _jsx("div", { style: { marginBottom: '16px' }, children: _jsx(Checkbox, { label: "Enabled", checked: enabled, onChange: setEnabled }) }), _jsx("div", { style: { marginBottom: '16px' }, children: _jsx(Checkbox, { label: "Show secrets", checked: showSecrets, onChange: setShowSecrets }) }), definition?.fields?.length ? (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: definition.fields.map((f) => {
                                    const v = values[f.key] ?? '';
                                    const common = {
                                        label: `${f.label}${f.required ? ' *' : ''}`,
                                        value: v,
                                        onChange: (nv) => setValues((prev) => ({ ...prev, [f.key]: nv })),
                                        disabled: loading || saving,
                                        required: !!f.required,
                                    };
                                    if (f.type === 'json') {
                                        return (_jsxs("div", { children: [_jsx(TextArea, { ...common, rows: 5, placeholder: f.description || '{ }' }), f.description ? (_jsx("div", { style: { marginTop: '4px', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }, children: f.description })) : null] }, f.key));
                                    }
                                    return (_jsxs("div", { children: [_jsx(Input, { ...common, type: f.type === 'secret' ? (showSecrets ? 'text' : 'password') : f.type === 'number' ? 'number' : 'text', placeholder: f.description || '' }), f.description ? (_jsx("div", { style: { marginTop: '4px', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }, children: f.description })) : null] }, f.key));
                                }) })) : (_jsx("div", { style: { color: 'var(--hit-muted-foreground, #64748b)', fontSize: '14px' }, children: "No fields defined for this partner." }))] }), credential ? (_jsx(Card, { children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500, marginBottom: '4px' }, children: "Remove credentials" }), _jsx("div", { style: { fontSize: '14px', color: 'var(--hit-muted-foreground, #64748b)' }, children: "Deletes the stored credentials for this partner." })] }), _jsx(Button, { variant: "danger", onClick: remove, disabled: saving || loading, children: "Remove" })] }) })) : null] })] }));
}
export default IntegrationDetail;
