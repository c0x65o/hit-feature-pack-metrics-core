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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Metric Key</th>
                  <th className="py-3 pr-4 font-medium">Label</th>
                  <th className="py-3 pr-4 font-medium">Unit</th>
                  <th className="py-3 pr-4 font-medium">Category</th>
                  <th className="py-3 pr-4 font-medium text-right">Points</th>
                  <th className="py-3 pr-4 font-medium">First</th>
                  <th className="py-3 pr-4 font-medium">Last</th>
                  <th className="py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .slice()
                  .sort((a, b) => a.key.localeCompare(b.key))
                  .map((d) => (
                    <tr key={d.key} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 pr-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{d.key}</code>
                      </td>
                      <td className="py-3 pr-4 font-medium">{d.label}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {d.unit}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{d.category || '—'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {d.pointsCount > 0 ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">{d.pointsCount.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                        {d.firstPointAt ? new Date(d.firstPointAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                        {d.lastPointAt ? new Date(d.lastPointAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 text-muted-foreground tabular-nums">
                        {d.lastUpdatedAt ? new Date(d.lastUpdatedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default Definitions;


