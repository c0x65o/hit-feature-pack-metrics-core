'use client';

import React from 'react';
import { Badge } from '@hit/ui-kit/components/Badge';
import { Button } from '@hit/ui-kit/components/Button';
import { Card } from '@hit/ui-kit/components/Card';

type ProviderRow = {
  id: string;
  label: string;
  description: string | null;
  metricsCount: number;
  // provider.metrics is not returned by the list endpoint today; we show count only on the list.
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

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  } else {
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  }
}

export function Providers() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<ProviderRow[]>([]);
  const [now, setNow] = React.useState(new Date());

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

  // Update relative times every minute
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Providers</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            A provider is an ingestor configuration + its artifacts (mappings, integrations, backfill/upload, tasks, and run state).
          </p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <Card title={`Providers (${items.length})`} description="Configured from schema/metrics/ingestors/*.yaml">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No providers configured.</div>
        ) : (
          <div className="space-y-4">
            {items.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-lg border bg-hit-surface border-hit-border p-5 transition-all hover:shadow-md hover:border-hit-strong"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2">
                      <h3 className="text-base font-semibold">
                        {p.label}
                      </h3>
                      {p.description && (
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className={p.uploadEnabled ? 'text-green-500' : 'text-muted-foreground'}>●</span>
                        {p.uploadEnabled ? 'Upload' : 'No upload'}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={p.backfillEnabled ? 'text-green-500' : 'text-muted-foreground'}>●</span>
                        {p.backfillEnabled ? 'Backfill' : 'No backfill'}
                      </span>
                      <span>files: {p.backfillFilesCount}</span>
                      {p.backfillTaskName && <span>task: {p.backfillTaskName}</span>}
                      {p.syncTaskName && <span>sync: {p.syncTaskName}</span>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {badgeFor(p.preflight.mappingOk, 'Mappings OK', `Missing ${p.preflight.mappingMissingCount ?? 0} mappings`, 'Mappings —')}
                      {p.preflight.integrationPartnerId
                        ? badgeFor(
                            p.preflight.integrationOk,
                            'Integration OK',
                            `Missing integration (${(p.preflight.integrationMissingFields || []).join(', ') || 'required fields'})`,
                            'Integration —',
                          )
                        : <Badge variant="default">No integration</Badge>}
                      {p.stats.dataSourcesCount !== null && (
                        <Badge variant="default">{p.stats.dataSourcesCount} sources</Badge>
                      )}
                      <Badge variant="default">{p.metricsCount} metrics</Badge>
                      {p.stats.pointsCount !== null ? (
                        <Badge variant="info">{p.stats.pointsCount} points</Badge>
                      ) : (
                        <Badge variant="default">Points —</Badge>
                      )}
                      {p.stats.lastPointDate && (
                        <Badge variant="default">Last: {formatTimeAgo(p.stats.lastPointDate)}</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => (window.location.href = `/metrics/providers/${encodeURIComponent(p.id)}`)}
                      className="transition-opacity group-hover:opacity-100"
                    >
                      Open
                    </Button>
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

export default Providers;


