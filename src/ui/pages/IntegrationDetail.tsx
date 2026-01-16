import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { AlertDialog } from '@hit/ui-kit/components/AlertDialog';
import { useAlertDialog } from '@hit/ui-kit/hooks/useAlertDialog';

type Field = {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'number' | 'json';
  required?: boolean;
  description?: string;
};

type Definition = {
  id: string;
  label: string;
  description?: string;
  fields: Field[];
  verify?: { kind: 'http' | 'command' } | null;
};

type Credential = {
  id: string;
  enabled: boolean;
  credentials: Record<string, unknown>;
  lastVerifiedAt: string | null;
  lastVerifyOk: boolean | null;
  lastVerifyMessage: string | null;
};

export function IntegrationDetail(props: { id?: string; onNavigate?: (path: string) => void }) {
  const { Page, Card, Button, Input, TextArea, Checkbox, Badge } = useUi();
  const alert = useAlertDialog();
  const partnerId = props.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  const navigate = (path: string) => {
    if (props.onNavigate) props.onNavigate(path);
    else window.location.href = path;
  };

  async function load() {
    if (!partnerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}`, { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to load partner');
      setDefinition(json.definition as Definition);
      const cred = (json.credential as Credential | null) ?? null;
      setCredential(cred);
      setEnabled(cred?.enabled ?? true);

      const nextValues: Record<string, string> = {};
      const creds = (cred?.credentials || {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(creds)) {
        nextValues[k] = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      }
      setValues(nextValues);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load partner');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  const status = useMemo(() => {
    if (!credential) return { label: 'Not configured', variant: 'default' as const };
    if (!enabled) return { label: 'Disabled', variant: 'default' as const };
    if (credential.lastVerifyOk === true) return { label: 'Verified', variant: 'success' as const };
    if (credential.lastVerifyOk === false) return { label: 'Verify failed', variant: 'error' as const };
    return { label: 'Not verified', variant: 'default' as const };
  }, [credential, enabled]);

  async function save() {
    if (!partnerId || !definition) return;
    setSaving(true);
    setError(null);
    try {
      const credsPayload: Record<string, unknown> = {};
      for (const f of definition.fields) {
        const v = values[f.key] ?? '';
        if (f.type === 'number') {
          const n = Number(v);
          if (v.trim() !== '' && Number.isFinite(n)) credsPayload[f.key] = n;
          else if (v.trim() !== '') credsPayload[f.key] = v; // let server validate
        } else if (f.type === 'json') {
          if (!v.trim()) continue;
          try {
            credsPayload[f.key] = JSON.parse(v);
          } catch {
            credsPayload[f.key] = v;
          }
        } else {
          credsPayload[f.key] = v;
        }
      }

      const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, credentials: credsPayload }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to save');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    if (!partnerId || !definition?.verify) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}/verify`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Verify failed');
      await alert.showAlert(json?.message || (json?.ok ? 'Verified' : 'Verify failed'), {
        title: json?.ok ? 'Verified' : 'Verify failed',
        variant: json?.ok ? 'success' : 'error',
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verify failed';
      setError(msg);
      await alert.showAlert(msg, { title: 'Verify failed', variant: 'error' });
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    if (!partnerId) return;
    const ok = await alert.showConfirm(`Remove credentials for "${partnerId}"?`, {
      title: 'Remove credentials',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'error',
    });
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics/partners/${encodeURIComponent(partnerId)}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to delete');
      navigate('/metrics/integrations');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  if (!partnerId) {
    return (
      <Page title="Integration">
        <Card>Missing integration id</Card>
      </Page>
    );
  }

  return (
    <>
      <AlertDialog {...alert.props} />
      <Page
        title={definition?.label || partnerId}
        description={definition?.description}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => navigate('/metrics/integrations')}>
              Back
            </Button>
            <Button variant="secondary" onClick={save} disabled={loading || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {definition?.verify ? (
              <Button variant="primary" onClick={verify} disabled={loading || saving || verifying || !credential || !enabled}>
                {verifying ? 'Verifying…' : 'Verify'}
              </Button>
            ) : null}
          </div>
        }
      >
        <Card>
          {error && (
            <div style={{ marginBottom: '12px', color: 'var(--hit-error, #ef4444)', fontSize: '14px' }}>{error}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Badge variant={status.variant}>{status.label}</Badge>
            {credential?.lastVerifiedAt ? (
              <span style={{ fontSize: '13px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                Last verified: {new Date(credential.lastVerifiedAt).toLocaleString()}
              </span>
            ) : null}
            {credential?.lastVerifyMessage ? (
              <span style={{ fontSize: '13px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                {credential.lastVerifyMessage}
              </span>
            ) : null}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Checkbox label="Enabled" checked={enabled} onChange={setEnabled} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <Checkbox label="Show secrets" checked={showSecrets} onChange={setShowSecrets} />
          </div>

          {definition?.fields?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {definition.fields.map((f) => {
                const v = values[f.key] ?? '';
                const common = {
                  label: `${f.label}${f.required ? ' *' : ''}`,
                  value: v,
                  onChange: (nv: string) => setValues((prev) => ({ ...prev, [f.key]: nv })),
                  disabled: loading || saving,
                  required: !!f.required,
                };

                if (f.type === 'json') {
                  return (
                    <div key={f.key}>
                      <TextArea {...common} rows={5} placeholder={f.description || '{ }'} />
                      {f.description ? (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                          {f.description}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div key={f.key}>
                    <Input
                      {...common}
                      type={f.type === 'secret' ? (showSecrets ? 'text' : 'password') : f.type === 'number' ? 'number' : 'text'}
                      placeholder={f.description || ''}
                    />
                    {f.description ? (
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                        {f.description}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: 'var(--hit-muted-foreground, #64748b)', fontSize: '14px' }}>
              No fields defined for this partner.
            </div>
          )}
        </Card>

        {credential ? (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>Remove credentials</div>
                <div style={{ fontSize: '14px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                  Deletes the stored credentials for this partner.
                </div>
              </div>
              <Button variant="danger" onClick={remove} disabled={saving || loading}>
                Remove
              </Button>
            </div>
          </Card>
        ) : null}
      </Page>
    </>
  );
}

export default IntegrationDetail;


