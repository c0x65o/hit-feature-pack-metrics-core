import React, { useEffect, useMemo, useState } from 'react';
import { useUi } from '@hit/ui-kit';

type LinkRow = {
  id: string;
  linkType: string;
  linkId: string;
  targetKind: string;
  targetId: string;
  metadata: any;
  updatedAt: string;
};

export function Mappings(props: { onNavigate?: (path: string) => void }) {
  const { Page, Card, Button, Input, Table } = useUi();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const navigate = (path: string) => {
    if (props.onNavigate) props.onNavigate(path);
    else window.location.href = path;
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/metrics/links', window.location.origin);
      if (q.trim()) url.searchParams.set('q', q.trim());
      url.searchParams.set('limit', '500');
      const res = await fetch(url.toString(), { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to load mappings');
      setRows(Array.isArray(json?.data) ? (json.data as LinkRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const examples = useMemo(() => {
    return `Examples:\n\nSteam CSV filename → project:\n- linkType = "metrics.field_mapper"\n- linkId = EXACT filename (e.g. "Aquamarine - Sales Data.csv")\n- metadata = { "project_slug": "aquamarine" }`;
  }, []);

  return (
    <Page
      title="Mappings"
      description="Manage metrics_links rows used for filename→id mappings and other global metadata."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      }
    >
      <Card>
        {error ? <div style={{ marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'end', marginBottom: '12px' }}>
          <Input label="Search link id" value={q} onChange={setQ} />
          <Button variant="secondary" onClick={load} disabled={loading}>
            Search
          </Button>
        </div>

        <pre style={{ fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)', whiteSpace: 'pre-wrap' }}>
          {examples}
        </pre>

        <div style={{ marginTop: '12px' }}>
          <Table
            loading={loading}
            emptyMessage="No mappings found."
            columns={[
              { key: 'linkType', label: 'Link Type' },
              { key: 'linkId', label: 'Link ID' },
              { key: 'target', label: 'Target' },
              { key: 'metadata', label: 'Metadata' },
              { key: 'updated', label: 'Updated' },
              { key: 'actions', label: '', hideable: false },
            ]}
            data={rows.map((r) => ({
              linkType: r.linkType,
              linkId: r.linkId,
              target: r.targetKind && r.targetKind !== 'none' ? `${r.targetKind}:${r.targetId}` : '—',
              metadata: (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                    View
                  </summary>
                  <pre style={{ marginTop: '6px', fontSize: '11px', overflow: 'auto' }}>
                    {JSON.stringify(r.metadata ?? {}, null, 2)}
                  </pre>
                </details>
              ),
              updated: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—',
              actions: (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/metrics/mappings/${encodeURIComponent(r.linkType)}#edit=${encodeURIComponent(r.id)}`)}
                >
                  Edit
                </Button>
              ),
            }))}
          />
        </div>
      </Card>
    </Page>
  );
}

export default Mappings;


