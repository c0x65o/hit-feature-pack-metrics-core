'use client';

import React from 'react';
import { Button, Card, Input } from '@hit/ui-kit';

type DataSource = {
  id: string;
  entityKind: string;
  entityId: string;
  connectorKey: string;
  sourceKind: string;
  externalRef: string | null;
  enabled: boolean;
};

export function DataSources() {
  const [sources, setSources] = React.useState<DataSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [entityKind, setEntityKind] = React.useState('project');
  const [entityId, setEntityId] = React.useState('');
  const [connectorKey, setConnectorKey] = React.useState('');
  const [sourceKind, setSourceKind] = React.useState('api');
  const [externalRef, setExternalRef] = React.useState('');

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/metrics/data-sources');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const json = (await res.json()) as { data: DataSource[] };
      setSources(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    try {
      setError(null);
      const res = await fetch('/api/metrics/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityKind,
          entityId,
          connectorKey,
          sourceKind,
          externalRef: externalRef.trim() ? externalRef.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Create failed: ${res.status}`);
      }
      setEntityId('');
      setConnectorKey('');
      setExternalRef('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Data Sources</h1>
          <p className="text-muted-foreground">
            Data sources are the “inventory” of connectors/configs that produce metric points.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card title="Create Data Source" description="Adds a new data source row. (Auth required.)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Entity kind" value={entityKind} onChange={setEntityKind} placeholder="project" />
          <Input label="Entity id" value={entityId} onChange={setEntityId} placeholder="proj_123" />
          <Input label="Connector key" value={connectorKey} onChange={setConnectorKey} placeholder="storefront.steam.api" />
          <Input label="Source kind" value={sourceKind} onChange={setSourceKind} placeholder="api" />
          <Input label="External ref (optional)" value={externalRef} onChange={setExternalRef} placeholder="123456 or https://..." />
        </div>
        <div className="mt-3">
          <Button variant="primary" onClick={() => create()} disabled={!entityKind.trim() || !entityId.trim() || !connectorKey.trim() || !sourceKind.trim()}>
            Create
          </Button>
        </div>
      </Card>

      <Card title={`Data Sources (${sources.length})`} description="Current configured data sources.">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="text-sm text-muted-foreground">No data sources yet.</div>
        ) : (
          <div className="space-y-2">
            {sources
              .slice()
              .sort((a, b) => a.connectorKey.localeCompare(b.connectorKey))
              .map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-4 border-b py-2">
                  <div>
                    <div className="font-medium">{s.connectorKey}</div>
                    <div className="text-sm text-muted-foreground">
                      {s.entityKind}:{s.entityId} · {s.sourceKind}
                      {s.externalRef ? ` · ${s.externalRef}` : ''}
                      {s.enabled ? '' : ' · disabled'}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default DataSources;


