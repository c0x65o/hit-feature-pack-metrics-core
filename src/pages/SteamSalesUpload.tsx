'use client';

import React from 'react';
import { Button, Card, Input } from '@hit/ui-kit';

type UploadResult =
  | {
      status: 'ingested';
      ingestBatchId: string;
      replacedBatchId: string | null;
      file: { name: string; size: number };
      dateRange: { start: string; end: string };
      points: { ingested: number };
    }
  | {
      status: 'skipped';
      reason: string;
      existingBatchId: string;
      existingFileSize: number;
      newFileSize: number;
      dateRange: { start: string; end: string };
    };

export function SteamSalesUpload() {
  const [file, setFile] = React.useState<File | null>(null);
  const [entityKind, setEntityKind] = React.useState('org');
  const [entityId, setEntityId] = React.useState('hitcents');
  const [dataSourceId, setDataSourceId] = React.useState('ds_steam_sales_files');
  const [overwrite, setOverwrite] = React.useState(false);
  const [result, setResult] = React.useState<UploadResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function upload() {
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const form = new FormData();
      form.append('file', file);
      form.append('entityKind', entityKind);
      form.append('entityId', entityId);
      form.append('dataSourceId', dataSourceId);
      form.append('overwrite', overwrite ? 'true' : 'false');

      const res = await fetch('/api/metrics/uploads/steam-sales', { method: 'POST', body: form });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(json?.error || `Upload failed: ${res.status}`);
      }
      setResult(json as UploadResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Steam Sales Upload</h1>
        <p className="text-muted-foreground">
          Upload monthly Steam sales CSV exports (daily rows). We map filename → Steam App ID and ingest points into metrics-core.
        </p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card title="Upload" description="Overlap policy: keep the larger file for the same date range (unless overwrite=true).">
        <div className="space-y-3">
          <div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={loading}
            />
            <div className="text-xs text-muted-foreground mt-1">
              Expected: <code>* - Sales Data.csv</code>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Entity kind" value={entityKind} onChange={setEntityKind} />
            <Input label="Entity id" value={entityId} onChange={setEntityId} />
            <Input label="Data source id" value={dataSourceId} onChange={setDataSourceId} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={loading} />
            Overwrite existing batch even if it’s larger/equal
          </label>

          <Button variant="primary" onClick={() => upload()} disabled={!file || loading}>
            {loading ? 'Uploading…' : 'Upload & Ingest'}
          </Button>
        </div>
      </Card>

      {result ? (
        <Card title="Result">
          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}

export default SteamSalesUpload;


