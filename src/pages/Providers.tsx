'use client';

import React from 'react';
import { Button, Card, Badge } from '@hit/ui-kit';

type ProviderRow = {
  id: string;
  label: string;
  description: string | null;
  metricsCount: number;
  uploadEnabled: boolean;
  backfillEnabled: boolean;
  dataSourceId: string | null;
  backfillTaskName: string | null;
  backfillTaskCommand: string | null;
  syncTaskName: string | null;
  syncTaskCommand: string | null;
  backfillFilesCount: number;
  preflight: {
    mappingOk: boolean | null;
    mappingMissingCount: number | null;
    integrationPartnerId: string | null;
    integrationRequired: boolean;
    integrationOk: boolean | null;
    integrationMissingFields: string[] | null;
  };
  stats: {
    dataSourcesCount: number | null;
    pointsCount: number | null;
    firstPointDate: string | null;
    lastPointDate: string | null;
    lastUpdatedAt: string | null;
    lastBatchAt: string | null;
    lastBatchFile: string | null;
  };
};

function badgeFor(ok: boolean | null, labelOk: string, labelBad: string, labelUnknown = '—') {
  if (ok === null) return <Badge variant="default">{labelUnknown}</Badge>;
  if (ok) return <Badge variant="success">{labelOk}</Badge>;
  return <Badge variant="error">{labelBad}</Badge>;
}

export function Providers() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<ProviderRow[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/metrics/providers', { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to load providers');
      setItems(Array.isArray(json?.data) ? (json.data as ProviderRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="text-muted-foreground">
            A provider is an ingestor configuration + its artifacts (mappings, integrations, backfill/upload, tasks, and run state).
          </p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card title={`Providers (${items.length})`} description="Configured from .hit/metrics/ingestors/*.yaml">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No providers configured.</div>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-4 border-b py-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.label}</div>
                  <div className="text-sm text-muted-foreground truncate">{p.description || p.id}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                    <span>
                      {p.uploadEnabled ? 'Upload' : 'No upload'} · {p.backfillEnabled ? 'Backfill' : 'No backfill'} · {p.metricsCount} metric(s)
                    </span>
                    <span>· files: {p.backfillFilesCount}</span>
                    {p.backfillTaskName ? <span>· task: {p.backfillTaskName}</span> : <span>· task: —</span>}
                    {p.syncTaskName ? <span>· sync: {p.syncTaskName}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {badgeFor(p.preflight.mappingOk, 'Mappings OK', `Missing ${p.preflight.mappingMissingCount ?? 0} mappings`, 'Mappings —')}
                    {p.preflight.integrationPartnerId
                      ? badgeFor(
                          p.preflight.integrationOk,
                          'Integration OK',
                          `Missing integration (${(p.preflight.integrationMissingFields || []).join(', ') || 'required fields'})`,
                          'Integration —',
                        )
                      : <Badge variant="default">No integration</Badge>}
                    {p.stats.dataSourcesCount !== null ? <Badge variant="default">{p.stats.dataSourcesCount} sources</Badge> : null}
                    {p.stats.pointsCount !== null ? <Badge variant="info">{p.stats.pointsCount} points</Badge> : <Badge variant="default">Points —</Badge>}
                    {p.stats.lastPointDate ? <Badge variant="default">Last: {p.stats.lastPointDate}</Badge> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => (window.location.href = `/metrics/providers/${encodeURIComponent(p.id)}`)}>
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default Providers;


