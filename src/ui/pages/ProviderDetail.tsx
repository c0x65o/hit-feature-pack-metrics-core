'use client';

import React from 'react';
import { Badge } from '@hit/ui-kit/components/Badge';
import { Button } from '@hit/ui-kit/components/Button';
import { Card } from '@hit/ui-kit/components/Card';
import { ChevronDown, ChevronRight } from 'lucide-react';

type ProviderPayload = {
  provider: any;
  artifacts: {
    backfillFiles: string[];
    mappingMissing: string[];
    linkedProjects?: Array<{
      projectId: string;
      projectSlug: string | null;
      steamAppIds: Array<{ steamAppId: string; group: string | null }>;
      fileNames: string[];
      totals?: { grossRevenueUsd: number; netRevenueUsd: number };
    }>;
    mapping: null | { kind: 'metrics_links'; linkType: string | null; key: string | null };
    integration: null | {
      partnerId: string;
      requiredFields: string[];
      configured: boolean;
      enabled: boolean;
      missingFields: string[];
    };
    stats: null | {
      pointsCount: number;
      firstPointDate: string | null;
      lastPointDate: string | null;
      lastUpdatedAt: string | null;
      dataSourcesCount?: number;
    };
    tasks: {
      backfill: null | { name: string; command: string; description: string | null; cron?: string | null; service_name?: string | null };
      sync?: null | { name: string; command: string; description: string | null; cron?: string | null; service_name?: string | null };
    };
  };
};

type TargetsPreviewResponse = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, any>>;
  meta: {
    id: string;
    kind: string | null;
    formId: string | null;
    limit: number;
    scanLimit: number;
    scanned: number;
    filtered: number;
    returned: number;
    truncatedScan: boolean;
  };
};

export function ProviderDetail() {
  const [id, setId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ProviderPayload | null>(null);

  const fmtUsd = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [],
  );

  React.useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('providers');
    setId(idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '');
  }, []);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics/providers/${encodeURIComponent(id)}`, { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to load provider');
      setData(json as ProviderPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load provider');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const provider = data?.provider;
  const artifacts = data?.artifacts;

  const mappingOk = artifacts ? artifacts.mappingMissing.length === 0 : null;
  const backfillTask = artifacts?.tasks?.backfill || null;
  const syncTask = artifacts?.tasks?.sync || null;
  const linkedProjects = artifacts?.linkedProjects || [];

  // Task execution via UI is not supported in the TypeScript-only architecture.
  // Tasks are executed via the job worker or CLI tools.
  const runningTaskName: string | null = null;
  const lastTriggeredExecutionId: string | null = null;
  async function runTask(task: { name: string; command: string }) {
    // Keep the UI button but steer users to the correct workflow.
    setError(`Task execution from the UI is not supported. Run this command from your terminal:\n${task.command}`);
    try {
      await navigator.clipboard.writeText(task.command);
    } catch {
      // ignore
    }
  }

  const targetsPreviewEnabled = !!provider?.targets_preview;
  const [targetsPreview, setTargetsPreview] = React.useState<TargetsPreviewResponse | null>(null);
  const [targetsPreviewLoading, setTargetsPreviewLoading] = React.useState(false);
  const [targetsPreviewError, setTargetsPreviewError] = React.useState<string | null>(null);
  const [artifactsExpanded, setArtifactsExpanded] = React.useState(false);

  async function loadTargetsPreview() {
    if (!id || !targetsPreviewEnabled) {
      setTargetsPreview(null);
      return;
    }
    setTargetsPreviewLoading(true);
    setTargetsPreviewError(null);
    try {
      // scanLimit: high enough for accurate-ish counts; limit: keep UI snappy
      const res = await fetch(
        `/api/metrics/providers/${encodeURIComponent(id)}/targets?scanLimit=2000&limit=50`,
        { method: 'GET' },
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || 'Failed to load targets preview');
      setTargetsPreview(json as TargetsPreviewResponse);
    } catch (e) {
      setTargetsPreviewError(e instanceof Error ? e.message : 'Failed to load targets preview');
      setTargetsPreview(null);
    } finally {
      setTargetsPreviewLoading(false);
    }
  }

  React.useEffect(() => {
    void loadTargetsPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, targetsPreviewEnabled]);

  // Upload UI (merged from IngestorDetail)
  const [file, setFile] = React.useState<File | null>(null);
  const [overwrite, setOverwrite] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadResult, setUploadResult] = React.useState<any>(null);

  async function upload() {
    if (!file || !id) return;
    try {
      setUploading(true);
      setError(null);
      setUploadResult(null);
      const form = new FormData();
      form.append('file', file);
      form.append('overwrite', overwrite ? 'true' : 'false');
      const res = await fetch(`/api/metrics/ingestors/${encodeURIComponent(id)}/upload`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Upload failed: ${res.status}`);
      setUploadResult(json);
      // Refresh provider detail so stats/totals update immediately.
      await load();
      await loadTargetsPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function downloadTargetsCsv() {
    if (!targetsPreview?.columns || !targetsPreview?.rows) return;
    const cols = targetsPreview.columns;
    const rows = targetsPreview.rows;

    function esc(v: any) {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      // escape CSV: wrap in quotes if needed, double quotes inside
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }

    const header = cols.map((c) => esc(c.label || c.key)).join(',');
    const body = rows
      .map((r) => cols.map((c) => esc((r as any)[c.key])).join(','))
      .join('\n');
    const csv = `${header}\n${body}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provider-${id}-targets.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Provider: {provider?.label || id || '—'}</h1>
          <p className="text-muted-foreground">{provider?.description || id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => (window.location.href = '/metrics/providers')}>
            Back
          </Button>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card title="Preflight">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !artifacts ? (
          <div className="text-sm text-muted-foreground">No data.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {mappingOk === null ? (
                <Badge variant="default">Mappings —</Badge>
              ) : mappingOk ? (
                <Badge variant="success">Mappings OK</Badge>
              ) : (
                <Badge variant="error">Missing {artifacts.mappingMissing.length} mappings</Badge>
              )}

              {artifacts.integration ? (
                artifacts.integration.configured && artifacts.integration.enabled && artifacts.integration.missingFields.length === 0 ? (
                  <Badge variant="success">Integration OK</Badge>
                ) : (
                  <Badge variant="error">Integration missing ({artifacts.integration.missingFields.join(', ') || 'required'})</Badge>
                )
              ) : (
                <Badge variant="default">No integration</Badge>
              )}

              {artifacts.stats ? <Badge variant="info">{artifacts.stats.pointsCount} points</Badge> : <Badge variant="default">Points —</Badge>}
              {artifacts.stats?.lastPointDate ? <Badge variant="default">Last point: {artifacts.stats.lastPointDate}</Badge> : null}
              {targetsPreviewEnabled ? (
                targetsPreviewLoading ? (
                  <Badge variant="default">Targets…</Badge>
                ) : targetsPreview?.meta ? (
                  <Badge variant="default">
                    Targets: {targetsPreview.meta.filtered}
                    {targetsPreview.meta.truncatedScan ? '+' : ''}
                  </Badge>
                ) : (
                  <Badge variant="default">Targets: —</Badge>
                )
              ) : null}
            </div>

            {artifacts.mappingMissing.length > 0 ? (
              <div className="text-sm">
                <div className="font-medium mb-1">Missing mappings (first 50):</div>
                <pre className="text-xs overflow-auto">{artifacts.mappingMissing.slice(0, 50).join('\n')}</pre>
                {artifacts.mapping?.linkType ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => (window.location.href = `/metrics/mappings/${encodeURIComponent(artifacts.mapping!.linkType!)}`)}
                    >
                      Open mappings ({artifacts.mapping.linkType})
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {targetsPreviewEnabled ? (
        <Card
          title="Targets"
          description="Preview of the records this provider will process (same discovery query; no scraping)."
        >
          {targetsPreviewLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : targetsPreviewError ? (
            <div className="text-sm text-red-600">{targetsPreviewError}</div>
          ) : targetsPreview?.meta ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{targetsPreview.meta.filtered}{targetsPreview.meta.truncatedScan ? '+' : ''} targets</Badge>
                <span className="text-xs text-muted-foreground">
                  scanned={targetsPreview.meta.scanned} scanLimit={targetsPreview.meta.scanLimit} returned={targetsPreview.meta.returned} limit={targetsPreview.meta.limit}
                </span>
                <div className="flex-1" />
                <Button variant="secondary" size="sm" onClick={downloadTargetsCsv} disabled={!targetsPreview.rows?.length}>
                  Download CSV
                </Button>
              </div>

              {targetsPreview.rows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No targets found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        {targetsPreview.columns.map((c) => (
                          <th key={c.key} className="py-2 pr-4 font-medium">
                            {c.label || c.key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {targetsPreview.rows.map((r, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                          {targetsPreview.columns.map((c) => (
                            <td key={c.key} className="py-2 pr-4">
                              {(() => {
                                const v = (r as any)[c.key];
                                if (v === null || v === undefined) return '—';
                                if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
                                return JSON.stringify(v);
                              })()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No targets preview configured.</div>
          )}
        </Card>
      ) : null}

      <Card title="Metrics">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !provider ? (
          <div className="text-sm text-muted-foreground">Provider not found.</div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{Array.isArray(provider.metrics) ? provider.metrics.length : 0} metrics</Badge>
            </div>
            {Array.isArray(provider.metrics) && provider.metrics.length > 0 ? (
              <details>
                <summary className="text-sm cursor-pointer">Show metric keys</summary>
                <pre className="text-xs overflow-auto mt-2">{provider.metrics.join('\n')}</pre>
              </details>
            ) : (
              <div className="text-sm text-muted-foreground">No metric keys declared on this provider.</div>
            )}
          </div>
        )}
      </Card>

      {linkedProjects.length > 0 ? (
        <Card title="Linked projects (file → project)">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {linkedProjects.map((p) => (
                  <div key={p.projectId} className="border rounded-md p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">{p.projectSlug || p.projectId}</Badge>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{p.projectId}</code>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Steam app ids (from CSV dims): {p.steamAppIds.map((x) => `${x.steamAppId}${x.group ? ` (${x.group})` : ''}`).join(', ') || '—'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Files: {p.fileNames.length}</div>
                    {p.totals ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Revenue (all-time): gross={fmtUsd.format(p.totals.grossRevenueUsd || 0)} · net={fmtUsd.format(p.totals.netRevenueUsd || 0)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : null}

      <Card title="Backfill task">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !backfillTask ? (
          <div className="text-sm text-muted-foreground">No backfill task found in hit.yaml for this provider.</div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{backfillTask.name}</Badge>
              <Button
                variant="primary"
                size="sm"
                disabled={runningTaskName === backfillTask.name}
                onClick={() => runTask(backfillTask)}
              >
                {runningTaskName === backfillTask.name ? 'Running…' : 'Run'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(backfillTask.command);
                  } catch {
                    // ignore
                  }
                }}
              >
                Copy command
              </Button>
            </div>
            <pre className="text-xs overflow-auto">{backfillTask.command}</pre>
            {backfillTask.cron ? <div className="text-xs text-muted-foreground">Cron: {backfillTask.cron}</div> : null}
            {lastTriggeredExecutionId && runningTaskName === null ? (
              <div className="text-xs text-muted-foreground">
                Triggered execution: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{lastTriggeredExecutionId}</code>
              </div>
            ) : null}
            {backfillTask.description ? <div className="text-sm text-muted-foreground">{backfillTask.description}</div> : null}
            <div className="text-xs text-muted-foreground">Runs through the Tasks system (same as the Jobs/Tasks page).</div>
          </div>
        )}
      </Card>

      <Card title="Sync task">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !syncTask ? (
          <div className="text-sm text-muted-foreground">No sync task found/configured for this provider.</div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{syncTask.name}</Badge>
              <Button
                variant="primary"
                size="sm"
                disabled={runningTaskName === syncTask.name}
                onClick={() => runTask(syncTask)}
              >
                {runningTaskName === syncTask.name ? 'Running…' : 'Run'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(syncTask.command);
                  } catch {
                    // ignore
                  }
                }}
              >
                Copy command
              </Button>
            </div>
            <pre className="text-xs overflow-auto">{syncTask.command}</pre>
            {syncTask.cron ? <div className="text-xs text-muted-foreground">Cron: {syncTask.cron}</div> : null}
            {lastTriggeredExecutionId && runningTaskName === null ? (
              <div className="text-xs text-muted-foreground">
                Triggered execution: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{lastTriggeredExecutionId}</code>
              </div>
            ) : null}
            {syncTask.description ? <div className="text-sm text-muted-foreground">{syncTask.description}</div> : null}
          </div>
        )}
      </Card>

      <Card>
        <button
          onClick={() => setArtifactsExpanded(!artifactsExpanded)}
          className="flex items-center gap-2 mb-3 text-left text-2xl font-bold"
        >
          {artifactsExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span>Artifacts</span>
        </button>
        {artifactsExpanded ? (
          loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !provider ? (
            <div className="text-sm text-muted-foreground">Provider not found.</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">Backfill</div>
                <div className="text-muted-foreground">
                  {provider?.backfill?.enabled ? 'enabled' : 'disabled'} · kind: {provider?.backfill?.kind || '—'} · dir:{' '}
                  {provider?.backfill?.dir || '—'} · pattern: {provider?.backfill?.pattern || '—'}
                </div>
                {artifacts ? (
                  <div className="text-muted-foreground">Files detected: {artifacts.backfillFiles.length}</div>
                ) : null}
              </div>

              <div className="text-sm">
                <div className="font-medium">Upload</div>
                <div className="text-muted-foreground">{provider?.upload?.enabled ? 'enabled' : 'disabled'}</div>
              </div>

              <div className="text-sm">
                <div className="font-medium">Config</div>
                <pre className="text-xs overflow-auto">{JSON.stringify(provider, null, 2)}</pre>
              </div>
            </div>
          )
        ) : null}
      </Card>

      <Card title="Upload & ingest">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !provider?.upload?.enabled ? (
          <div className="text-sm text-muted-foreground">Upload is disabled for this provider.</div>
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
            {uploadResult ? <pre className="text-xs overflow-auto">{JSON.stringify(uploadResult, null, 2)}</pre> : null}
          </div>
        )}
      </Card>
    </div>
  );
}

export default ProviderDetail;


