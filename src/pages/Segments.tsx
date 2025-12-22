import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';

type SegmentRow = {
  id: string;
  key: string;
  entityKind: string;
  label: string;
  description: string | null;
  rule: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function safeJsonParse(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

export function Segments(props: { onNavigate?: (path: string) => void }) {
  const { Page, Card, Button, Input, TextArea, Table, Badge, Modal, Select } = useUi();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SegmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [entityKindFilter, setEntityKindFilter] = useState<string>('');

  // Create/edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [entityKind, setEntityKind] = useState('project');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [ruleText, setRuleText] = useState(
    JSON.stringify(
      {
        kind: 'metric_threshold',
        metricKey: 'revenue_usd',
        agg: 'sum',
        op: '>=',
        value: 100000,
        // Optional:
        // start: '2025-01-01T00:00:00.000Z',
        // end: '2026-01-01T00:00:00.000Z',
      },
      null,
      2
    )
  );
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const navigate = (path: string) => {
    if (props.onNavigate) props.onNavigate(path);
    else window.location.href = path;
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/metrics/segments', window.location.origin);
      if (q.trim()) url.searchParams.set('q', q.trim());
      if (entityKindFilter.trim()) url.searchParams.set('entityKind', entityKindFilter.trim());
      const res = await fetch(url.toString(), { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || `Failed to load segments (${res.status})`);
      setRows(Array.isArray(json?.data) ? (json.data as SegmentRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entityKinds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(String(r.entityKind || ''));
    return Array.from(s).filter(Boolean).sort();
  }, [rows]);

  function openCreate() {
    setEditingKey(null);
    setKey('');
    setEntityKind('project');
    setLabel('');
    setDescription('');
    setIsActive(true);
    setRuleText(
      JSON.stringify(
        { kind: 'metric_threshold', metricKey: 'revenue_usd', agg: 'sum', op: '>=', value: 100000 },
        null,
        2
      )
    );
    setModalOpen(true);
  }

  function openEdit(row: SegmentRow) {
    setEditingKey(row.key);
    setKey(row.key);
    setEntityKind(row.entityKind);
    setLabel(row.label);
    setDescription(row.description || '');
    setIsActive(Boolean(row.isActive));
    setRuleText(JSON.stringify(row.rule ?? { kind: 'metric_threshold' }, null, 2));
    setModalOpen(true);
  }

  async function save() {
    const parsed = safeJsonParse(ruleText);
    if (!parsed.ok) {
      setError(`Rule JSON error: ${parsed.error}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!editingKey) {
        const res = await fetch('/api/metrics/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            entityKind,
            label,
            description: description.trim() ? description : null,
            rule: parsed.value,
            isActive,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Failed to create (${res.status})`);
      } else {
        const res = await fetch(`/api/metrics/segments/${encodeURIComponent(editingKey)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label,
            description: description.trim() ? description : null,
            rule: parsed.value,
            isActive,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Failed to update (${res.status})`);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: SegmentRow) {
    if (!confirm(`Delete segment "${row.key}"?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics/segments/${encodeURIComponent(row.key)}`, { method: 'DELETE' });
      if (!(res.status === 204 || res.ok)) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || `Failed to delete (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  }

  const activeBadge = (r: SegmentRow) =>
    r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge>;

  return (
    <Page
      title="Segments"
      description="Reusable selection/classification rules over entities (projects, users, etc.). Use segments for filters, dashboard scoping, and workflow targeting."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" onClick={openCreate}>
            New Segment
          </Button>
        </div>
      }
    >
      <Card>
        {error ? <div style={{ marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'end', marginBottom: '12px', flexWrap: 'wrap' }}>
          <Input label="Search" value={q} onChange={setQ} />
          <Select
            label="Entity kind"
            value={entityKindFilter}
            onChange={setEntityKindFilter}
            options={[
              { value: '', label: 'All' },
              ...entityKinds.map((k) => ({ value: k, label: k })),
            ]}
          />
          <Button variant="secondary" onClick={load} disabled={loading}>
            Apply
          </Button>
        </div>

        <Table
          loading={loading}
          emptyMessage="No segments found."
          columns={[
            { key: 'key', label: 'Key' },
            { key: 'entityKind', label: 'Entity' },
            { key: 'label', label: 'Label' },
            { key: 'status', label: 'Status' },
            { key: 'rule', label: 'Rule' },
            { key: 'actions', label: '' },
          ]}
          data={rows.map((r) => ({
            key: (
              <div>
                <div style={{ fontWeight: 500 }}>{r.key}</div>
                {r.description ? (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                    {r.description}
                  </div>
                ) : null}
              </div>
            ),
            entityKind: <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.entityKind}</span>,
            label: r.label,
            status: activeBadge(r),
            rule: (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                  View
                </summary>
                <pre style={{ marginTop: '6px', fontSize: '11px', overflow: 'auto' }}>
                  {JSON.stringify(r.rule ?? {}, null, 2)}
                </pre>
              </details>
            ),
            actions: (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={() => openEdit(r)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteRow(r)}>
                  Delete
                </Button>
              </div>
            ),
          }))}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingKey ? 'Edit Segment' : 'New Segment'}
        description="Segments are reusable selection rules. Store a stable key so other systems can reference it."
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Key"
            value={key}
            onChange={setKey}
            placeholder="segment.project.revenue_gte_100k_all_time"
            required
            disabled={Boolean(editingKey)}
          />
          <Input label="Label" value={label} onChange={setLabel} placeholder="High Revenue Projects" required />
          <Input label="Entity Kind" value={entityKind} onChange={setEntityKind} placeholder="project" required disabled={Boolean(editingKey)} />
          <Input label="Description" value={description} onChange={setDescription} placeholder="Optional" />

          <TextArea
            label="Rule (JSON)"
            value={ruleText}
            onChange={setRuleText}
            rows={12}
            placeholder='{"kind":"metric_threshold","metricKey":"revenue_usd","agg":"sum","op":">=","value":100000}'
          />

          <Select
            label="Status"
            value={isActive ? 'active' : 'inactive'}
            onChange={(v: string) => setIsActive(v === 'active')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={save}
              loading={saving}
              disabled={!key.trim() || !label.trim() || !entityKind.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}

export default Segments;


