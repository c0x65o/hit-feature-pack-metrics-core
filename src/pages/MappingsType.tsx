import React, { useEffect, useMemo, useState } from 'react';
import { AlertDialog, useAlertDialog, useUi } from '@hit/ui-kit';

type LinkRow = {
  id: string;
  linkType: string;
  linkId: string;
  targetKind: string;
  targetId: string;
  metadata: any;
  updatedAt: string;
};

function parseHashEditId() {
  const h = window.location.hash || '';
  const m = h.match(/edit=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function MappingsType(props: { type?: string; onNavigate?: (path: string) => void }) {
  const { Page, Card, Button, Input, TextArea, Table } = useUi();
  const alert = useAlertDialog();
  const type = props.type;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [linkId, setLinkId] = useState('');
  const [metadata, setMetadata] = useState('{\n  "steam_app_id": ""\n}');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const navigate = (path: string) => {
    if (props.onNavigate) props.onNavigate(path);
    else window.location.href = path;
  };

  async function load() {
    if (!type) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/metrics/links', window.location.origin);
      url.searchParams.set('linkType', type);
      url.searchParams.set('limit', '500');
      const res = await fetch(url.toString(), { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to load mappings');
      const data = Array.isArray(json?.data) ? (json.data as LinkRow[]) : [];
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mappings');
    } finally {
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
    if (typeof window === 'undefined') return;
    const id = parseHashEditId();
    if (!id) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setEditingId(row.id);
    setLinkId(row.linkId);
    setMetadata(JSON.stringify(row.metadata ?? {}, null, 2));
  }, [rows]);

  const title = useMemo(() => `Mappings: ${type || '—'}`, [type]);

  async function save() {
    if (!type) return;
    if (!linkId.trim()) {
      setError('Missing linkId');
      return;
    }
    let parsed: any = null;
    if (metadata.trim()) {
      try {
        parsed = JSON.parse(metadata);
      } catch {
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
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) throw new Error(json?.error || 'Failed to update');
      } else {
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
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) throw new Error(json?.error || 'Failed to create');
      }

      setEditingId(null);
      setLinkId('');
      setMetadata(type === 'metrics.field_mapper' ? '{\n  "steam_app_id": ""\n}' : '{\n}');
      window.location.hash = '';
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: LinkRow) {
    const ok = await alert.showConfirm(`Delete mapping "${row.linkId}"?`, {
      title: 'Delete mapping',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'error',
    });
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics/links/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to delete');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AlertDialog {...alert.props} />
      <Page
        title={title}
        description="Add/edit/delete mappings in metrics_links for this type."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => navigate('/metrics/mappings')}>
              Back
            </Button>
            <Button variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        <Card title={editingId ? 'Edit mapping' : 'Add mapping'}>
          {error ? <div style={{ marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }}>{error}</div> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input
              label="Link ID"
              value={linkId}
              onChange={setLinkId}
              placeholder={type === 'metrics.field_mapper' ? 'Aquamarine - Sales Data.csv' : 'identifier'}
              disabled={saving}
            />
            <TextArea label="Metadata (JSON)" value={metadata} onChange={setMetadata} rows={7} disabled={saving} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" onClick={save} disabled={saving || !linkId.trim()}>
                {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
              </Button>
              {editingId ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingId(null);
                    setLinkId('');
                    setMetadata(type === 'metrics.field_mapper' ? '{\n  "steam_app_id": ""\n}' : '{\n}');
                    window.location.hash = '';
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <Card title="Existing mappings">
          <Table
            loading={loading}
            emptyMessage="No mappings yet."
            columns={[
              { key: 'linkId', label: 'Link ID' },
              { key: 'steam', label: 'steam_app_id' },
              { key: 'updated', label: 'Updated' },
              { key: 'actions', label: '' },
            ]}
            data={rows.map((r) => ({
              linkId: r.linkId,
              steam: type === 'metrics.field_mapper' ? String(r?.metadata?.steam_app_id || '') : '—',
              updated: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—',
              actions: (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.hash = `edit=${encodeURIComponent(r.id)}`;
                      setEditingId(r.id);
                      setLinkId(r.linkId);
                      setMetadata(JSON.stringify(r.metadata ?? {}, null, 2));
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(r)} disabled={saving}>
                    Delete
                  </Button>
                </div>
              ),
            }))}
          />
        </Card>
      </Page>
    </>
  );
}

export default MappingsType;


