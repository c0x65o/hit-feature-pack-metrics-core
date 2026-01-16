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

export function Segments(props: { onNavigate?: (path: string) => void }) {
  const { Page, Card, Button, Table, Badge } = useUi();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SegmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [entityKindFilter, setEntityKindFilter] = useState<string>('');

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
          <Button variant="primary" onClick={() => navigate('/metrics/segments/new')}>
            New Segment
          </Button>
        </div>
      }
    >
      <Card>
        {error ? <div style={{ marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--hit-text-secondary, #64748b)' }}>
              Search
            </label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search segments..."
              style={{
                width: '100%',
                height: '36px',
                padding: '0 12px',
                fontSize: '14px',
                border: '1px solid var(--hit-border, #e2e8f0)',
                borderRadius: '6px',
                backgroundColor: 'var(--hit-bg-input, #fff)',
                color: 'var(--hit-text-primary, #1e293b)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: '0 0 auto', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: 'var(--hit-text-secondary, #64748b)' }}>
              Entity kind
            </label>
            <select
              value={entityKindFilter}
              onChange={(e) => setEntityKindFilter(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 12px',
                fontSize: '14px',
                border: '1px solid var(--hit-border, #e2e8f0)',
                borderRadius: '6px',
                backgroundColor: 'var(--hit-bg-input, #fff)',
                color: 'var(--hit-text-primary, #1e293b)',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              <option value="">All</option>
              {entityKinds.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <Button variant="secondary" onClick={load} disabled={loading}>
              Apply
            </Button>
          </div>
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
                <Button variant="secondary" size="sm" onClick={() => navigate(`/metrics/segments/${encodeURIComponent(r.key)}/edit`)}>
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
    </Page>
  );
}

export default Segments;


