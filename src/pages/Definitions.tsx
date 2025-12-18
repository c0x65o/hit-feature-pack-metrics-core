'use client';

import React from 'react';
import { Button, Card } from '@hit/ui-kit';

type MetricCatalogItem = {
  key: string;
  label: string;
  unit: string;
  category?: string;
  description?: string;
  pointsCount: number;
  firstPointAt: string | null;
  lastPointAt: string | null;
  lastUpdatedAt: string | null;
};

export function Definitions() {
  const [items, setItems] = React.useState<MetricCatalogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/metrics/catalog');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const json = (await res.json()) as { items?: MetricCatalogItem[] };
      setItems(Array.isArray(json.items) ? json.items : []);
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
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="text-muted-foreground">
            Configured metrics from <code>.hit/metrics/definitions</code>, plus live data coverage from ingested points.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card
        title={`Configured metrics (${items.length})`}
        description="Read-only. Configure metrics via .hit/metrics/definitions and ingest points via ingestors/sync."
      >
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No definitions yet.</div>
        ) : (
          <div className="space-y-2">
            {items
              .slice()
              .sort((a, b) => a.key.localeCompare(b.key))
              .map((d) => (
                <div key={d.key} className="flex items-start justify-between gap-4 border-b py-2">
                  <div>
                    <div className="font-medium">{d.key}</div>
                    <div className="text-sm text-muted-foreground">
                      {d.label} · {d.unit}
                      {d.category ? ` · ${d.category}` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {d.pointsCount.toLocaleString()} point(s)
                      {d.firstPointAt ? ` · first: ${new Date(d.firstPointAt).toISOString().slice(0, 10)}` : ' · first: —'}
                      {d.lastPointAt ? ` · last: ${new Date(d.lastPointAt).toISOString().slice(0, 10)}` : ' · last: —'}
                      {d.lastUpdatedAt ? ` · updated: ${new Date(d.lastUpdatedAt).toISOString().slice(0, 10)}` : ' · updated: —'}
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

export default Definitions;


