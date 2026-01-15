'use client';

import React from 'react';
import { Button } from '@hit/ui-kit/components/Button';
import { Card } from '@hit/ui-kit/components/Card';

export function Dashboard() {
  const [defsCount, setDefsCount] = React.useState<number | null>(null);
  const [dataSourcesCount, setDataSourcesCount] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const [defsRes, dsRes] = await Promise.all([
          fetch('/api/metrics/definitions'),
          fetch('/api/metrics/data-sources'),
        ]);

        if (!defsRes.ok) throw new Error(`Failed to load metric definitions: ${defsRes.status}`);
        if (!dsRes.ok) throw new Error(`Failed to load data sources: ${dsRes.status}`);

        const defsJson = (await defsRes.json()) as { data?: unknown[] };
        const dsJson = (await dsRes.json()) as { data?: unknown[] };

        if (!cancelled) {
          setDefsCount(Array.isArray(defsJson.data) ? defsJson.data.length : 0);
          setDataSourcesCount(Array.isArray(dsJson.data) ? dsJson.data.length : 0);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="text-muted-foreground">
            Core metrics system: definitions, data sources, ingestion, and fast aggregation queries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => (window.location.href = '/admin/jobs')}>
            Jobs Admin
          </Button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Metric Definitions" description="Registered metric keys available for ingestion/query.">
          <div className="text-3xl font-bold">{defsCount ?? '—'}</div>
        </Card>

        <Card title="Data Sources" description="Enabled connectors/configs that produce points.">
          <div className="text-3xl font-bold">{dataSourcesCount ?? '—'}</div>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
