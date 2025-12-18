'use client';

import React from 'react';
import { Button, Card, Badge } from '@hit/ui-kit';

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
      computed?: { revenueUsdAllTime?: string | null };
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
      backfill: null | { name: string; command: string; description: string | null };
      sync?: null | { name: string; command: string; description: string | null };
    };
  };
};

export function ProviderDetail() {
  const [id, setId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ProviderPayload | null>(null);
  const [includeComputed, setIncludeComputed] = React.useState(false);

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
      const url = new URL(`/api/metrics/providers/${encodeURIComponent(id)}`, window.location.origin);
      if (includeComputed) url.searchParams.set('includeComputed', '1');
      const res = await fetch(url.toString(), { method: 'GET' });
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
  }, [id, includeComputed]);

  const provider = data?.provider;
  const artifacts = data?.artifacts;

  const mappingOk = artifacts ? artifacts.mappingMissing.length === 0 : null;
  const backfillTask = artifacts?.tasks?.backfill || null;
  const syncTask = artifacts?.tasks?.sync || null;
  const linkedProjects = artifacts?.linkedProjects || [];

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

      <Card title="Linked projects (steam.app → project)">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : linkedProjects.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No linked projects found. Expected <code>metrics_links</code> rows with <code>link_type="steam.app"</code> linking steam_app_id → project.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIncludeComputed((v) => !v)}
                disabled={loading}
              >
                {includeComputed ? 'Hide computed totals' : 'Compute totals'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Computes totals on-demand (so we don’t do heavy work on every page load).
              </span>
            </div>

            <div className="space-y-2">
              {linkedProjects.map((p) => (
                <div key={p.projectId} className="border rounded-md p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{p.projectSlug || p.projectId}</Badge>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{p.projectId}</code>
                    {includeComputed ? (
                      <Badge variant="default">
                        revenue_usd total: {p.computed?.revenueUsdAllTime ?? '—'}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Steam app ids: {p.steamAppIds.map((x) => `${x.steamAppId}${x.group ? ` (${x.group})` : ''}`).join(', ') || '—'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Files: {p.fileNames.length}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

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
            {backfillTask.description ? <div className="text-sm text-muted-foreground">{backfillTask.description}</div> : null}
            <div className="text-xs text-muted-foreground">
              Note: there is no “run task” endpoint yet, so this UI currently exposes the exact command to run.
            </div>
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
            {syncTask.description ? <div className="text-sm text-muted-foreground">{syncTask.description}</div> : null}
          </div>
        )}
      </Card>

      <Card title="Artifacts">
        {loading ? (
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
              {provider?.upload?.enabled ? (
                <div className="mt-2">
                  <Button variant="primary" size="sm" onClick={() => (window.location.href = `/metrics/ingestors/${encodeURIComponent(provider.id)}`)}>
                    Open upload UI
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="text-sm">
              <div className="font-medium">Config</div>
              <pre className="text-xs overflow-auto">{JSON.stringify(provider, null, 2)}</pre>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default ProviderDetail;


