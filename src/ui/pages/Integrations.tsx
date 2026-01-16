import React, { useEffect, useState } from 'react';
import { useUi } from '@hit/ui-kit';

type PartnerListItem = {
  id: string;
  label: string;
  description: string | null;
  configured: boolean;
  enabled: boolean;
  lastVerifiedAt: string | null;
  lastVerifyOk: boolean | null;
  lastVerifyMessage: string | null;
};

export function Integrations(props: { onNavigate?: (path: string) => void }) {
  const { Page, Card, Button, Table, Badge } = useUi();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PartnerListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const navigate = (path: string) => {
    if (props.onNavigate) props.onNavigate(path);
    else window.location.href = path;
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/metrics/partners', { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to load partners');
      setItems(Array.isArray(json?.data) ? (json.data as PartnerListItem[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const statusBadge = (p: PartnerListItem) => {
    if (!p.configured) return <Badge variant="default">Not configured</Badge>;
    if (!p.enabled) return <Badge variant="default">Disabled</Badge>;
    if (p.lastVerifyOk === true) return <Badge variant="success">Verified</Badge>;
    if (p.lastVerifyOk === false) return <Badge variant="error">Verify failed</Badge>;
    return <Badge variant="default">Not verified</Badge>;
  };

  return (
    <Page
      title="Integrations"
      description="Configure integration partner credentials (API keys, tokens) and optionally verify connectivity."
      actions={
        <Button variant="secondary" onClick={load} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <Card>
        {error && (
          <div style={{ marginBottom: '12px', color: 'var(--hit-error, #ef4444)', fontSize: '14px' }}>{error}</div>
        )}

        <Table
          loading={loading}
          emptyMessage="No partners configured. Add partner definitions under .hit/metrics/partners/*.yaml"
          columns={[
            { key: 'label', label: 'Partner' },
            { key: 'status', label: 'Status' },
            { key: 'lastVerified', label: 'Last verified' },
            { key: 'actions', label: '' },
          ]}
          data={items.map((p) => ({
            label: (
              <div>
                <div style={{ fontWeight: 500 }}>{p.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--hit-muted-foreground, #64748b)' }}>{p.id}</div>
                {p.description ? (
                  <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--hit-muted-foreground, #64748b)' }}>
                    {p.description}
                  </div>
                ) : null}
              </div>
            ),
            status: statusBadge(p),
            lastVerified: p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toLocaleString() : '—',
            actions: (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/metrics/integrations/${p.id}`)}>
                Manage
              </Button>
            ),
          }))}
        />
      </Card>
    </Page>
  );
}

export default Integrations;


