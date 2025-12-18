'use client';

import React from 'react';
import { Button, Card, Input } from '@hit/ui-kit';

type MetricDef = {
  id: string;
  key: string;
  label: string;
  unit: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
};

export function Definitions() {
  const [defs, setDefs] = React.useState<MetricDef[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [key, setKey] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [unit, setUnit] = React.useState('count');

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/metrics/definitions');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const json = (await res.json()) as { data: MetricDef[] };
      setDefs(Array.isArray(json.data) ? json.data : []);
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
      const res = await fetch('/api/metrics/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, label, unit }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Create failed: ${res.status}`);
      }
      setKey('');
      setLabel('');
      setUnit('count');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Metric Definitions</h1>
          <p className="text-muted-foreground">
            Define metric keys, labels, units, and rollup rules. These keys are what scripts ingest and queries request.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card title="Create Definition" description="Add a new metric key. (Auth required.)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Key" value={key} onChange={setKey} placeholder="revenue_usd" />
          <Input label="Label" value={label} onChange={setLabel} placeholder="Revenue (USD)" />
          <Input label="Unit" value={unit} onChange={setUnit} placeholder="usd" />
        </div>
        <div className="mt-3">
          <Button variant="primary" onClick={() => create()} disabled={!key.trim() || !label.trim()}>
            Create
          </Button>
        </div>
      </Card>

      <Card title={`Definitions (${defs.length})`} description="Current registered metric definitions.">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : defs.length === 0 ? (
          <div className="text-sm text-muted-foreground">No definitions yet.</div>
        ) : (
          <div className="space-y-2">
            {defs
              .slice()
              .sort((a, b) => a.key.localeCompare(b.key))
              .map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-4 border-b py-2">
                  <div>
                    <div className="font-medium">{d.key}</div>
                    <div className="text-sm text-muted-foreground">
                      {d.label} · {d.unit}
                      {d.category ? ` · ${d.category}` : ''}
                      {d.isActive ? '' : ' · disabled'}
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


