'use client';

import React from 'react';
import { Button, Card } from '@hit/ui-kit';

type Ingestor = {
  id: string;
  label: string;
  description?: string;
  metrics?: string[];
  upload?: { enabled?: boolean };
  backfill?: { enabled?: boolean };
};

export function Ingestors() {
  const [items, setItems] = React.useState<Ingestor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/metrics/ingestors');
      if (!res.ok) throw new Error(`Failed to load ingestors: ${res.status}`);
      const json = (await res.json()) as { ingestors?: Ingestor[] };
      setItems(Array.isArray(json.ingestors) ? json.ingestors : []);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Metric Ingestors</h1>
          <p className="text-muted-foreground">
            Config-driven ingestion sources from <code>.hit/metrics/ingestors</code>.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card title={`Ingestors (${items.length})`} description="Each ingestor may support upload, backfill, and/or scheduled sync.">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No ingestors configured.</div>
        ) : (
          <div className="space-y-3">
            {items.map((ing) => (
              <div key={ing.id} className="flex items-start justify-between gap-4 border-b py-3">
                <div>
                  <div className="font-medium">{ing.label || ing.id}</div>
                  <div className="text-sm text-muted-foreground">{ing.description || ing.id}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {ing.upload?.enabled ? 'Upload' : 'No upload'} · {ing.backfill?.enabled ? 'Backfill' : 'No backfill'}
                    {ing.metrics?.length ? ` · ${ing.metrics.length} metric(s)` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  {ing.upload?.enabled ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => (window.location.href = `/metrics/ingestors/${encodeURIComponent(ing.id)}`)}
                    >
                      Open
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => (window.location.href = `/metrics/ingestors/${encodeURIComponent(ing.id)}`)}
                    >
                      Open
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default Ingestors;


