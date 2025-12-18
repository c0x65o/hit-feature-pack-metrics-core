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
  data_source?: { id: string };
  scope?: { entity_kind: string; entity_id: string };
};

export function IngestorDetail() {
  const [ingestorId, setIngestorId] = React.useState<string>('');
  const [ing, setIng] = React.useState<Ingestor | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [overwrite, setOverwrite] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    const idx = parts.indexOf('ingestors');
    const id = idx >= 0 ? parts[idx + 1] : '';
    setIngestorId(id || '');
  }, []);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const res = await fetch('/api/metrics/ingestors');
      if (!res.ok) throw new Error(`Failed to load ingestors: ${res.status}`);
      const json = (await res.json()) as { ingestors?: Ingestor[] };
      const list = Array.isArray(json.ingestors) ? json.ingestors : [];
      const found = list.find((x) => x.id === ingestorId) || null;
      setIng(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!ingestorId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestorId]);

  async function upload() {
    if (!file || !ingestorId) return;
    try {
      setUploading(true);
      setError(null);
      setResult(null);
      const form = new FormData();
      form.append('file', file);
      form.append('overwrite', overwrite ? 'true' : 'false');
      const res = await fetch(`/api/metrics/ingestors/${encodeURIComponent(ingestorId)}/upload`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Upload failed: ${res.status}`);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ingestor: {ingestorId || '—'}</h1>
          <p className="text-muted-foreground">Dynamic ingestion configured in <code>.hit/metrics/ingestors</code>.</p>
        </div>
        <Button variant="secondary" onClick={() => (window.location.href = '/metrics/ingestors')}>
          Back
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card title="Config">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : ing ? (
          <pre className="text-xs overflow-auto">{JSON.stringify(ing, null, 2)}</pre>
        ) : (
          <div className="text-sm text-muted-foreground">Ingestor not found.</div>
        )}
      </Card>

      <Card title="Upload">
        {!ing?.upload?.enabled ? (
          <div className="text-sm text-muted-foreground">Upload is disabled for this ingestor.</div>
        ) : (
          <div className="space-y-3">
            <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Overwrite existing batch even if it’s larger/equal
            </label>
            <Button variant="primary" onClick={() => upload()} disabled={!file || uploading}>
              {uploading ? 'Uploading…' : 'Upload & Ingest'}
            </Button>
          </div>
        )}
      </Card>

      {result ? (
        <Card title="Result">
          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}

export default IngestorDetail;


