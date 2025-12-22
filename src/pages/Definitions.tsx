'use client';

import React from 'react';
import { Button, Card } from '@hit/ui-kit';
import { ChevronDown, ChevronRight } from 'lucide-react';

type MetricCatalogItem = {
  key: string;
  label: string;
  unit: string;
  category?: string;
  description?: string;
  rollup_strategy?: 'sum' | 'avg' | 'min' | 'max' | 'last';
  time_kind?: 'timeseries' | 'realtime' | 'none';
  default_granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  allowed_granularities?: Array<'hourly' | 'daily' | 'weekly' | 'monthly'>;
  owner?: { kind: 'feature_pack' | 'app' | 'user'; id: string };
  entity_kinds?: string[];
  dimensions_schema?: Record<string, any>;
  pointsCount: number;
  firstPointAt: string | null;
  lastPointAt: string | null;
  lastUpdatedAt: string | null;
};

function SourceChip(props: { owner?: MetricCatalogItem['owner'] }) {
  const owner = props.owner;
  const kind = owner?.kind;

  const className =
    kind === 'feature_pack'
      ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      : kind === 'app'
        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : kind === 'user'
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-muted text-muted-foreground';

  const text =
    kind === 'feature_pack'
      ? `fp:${owner?.id ?? 'unknown'}`
      : kind === 'app'
        ? 'app'
        : kind === 'user'
          ? 'user'
          : '—';

  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{text}</span>;
}

function sourceKey(owner?: MetricCatalogItem['owner']): string {
  if (owner?.kind === 'feature_pack') return `fp:${owner.id}`;
  if (owner?.kind === 'app') return 'app';
  if (owner?.kind === 'user') return 'user';
  return '—';
}

function sourceLabel(owner?: MetricCatalogItem['owner']): string {
  if (owner?.kind === 'feature_pack') return `Feature pack: ${owner.id}`;
  if (owner?.kind === 'app') return 'App';
  if (owner?.kind === 'user') return `User: ${owner.id}`;
  return '—';
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    // For older dates, show the date
    return date.toLocaleDateString();
  } catch {
    return '—';
  }
}

export function Definitions() {
  const [items, setItems] = React.useState<MetricCatalogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [selectedSources, setSelectedSources] = React.useState<Set<string>>(new Set());
  const [groupedView, setGroupedView] = React.useState(true);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/metrics/catalog');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const json = (await res.json()) as { items?: MetricCatalogItem[]; message?: string };
      const loadedItems = Array.isArray(json.items) ? json.items : [];
      setItems(loadedItems);
      setMessage(typeof json.message === 'string' ? json.message : null);
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

  // Initialize selected sources with all available sources when items are first loaded
  React.useEffect(() => {
    if (items.length > 0 && selectedSources.size === 0) {
      const allSources = new Set<string>();
      for (const item of items) {
        const source = sourceKey(item.owner);
        allSources.add(source);
      }
      setSelectedSources(allSources);
    }
  }, [items, selectedSources.size]);

  // Extract unique sources from items
  const availableSources = React.useMemo(() => {
    const sources = new Set<string>();
    for (const item of items) {
      const source = sourceKey(item.owner);
      sources.add(source);
    }
    return Array.from(sources).sort();
  }, [items]);

  // Filter items based on selected sources
  const filteredItems = React.useMemo(() => {
    if (selectedSources.size === 0) return items;
    return items.filter((item) => {
      const source = sourceKey(item.owner);
      return selectedSources.has(source);
    });
  }, [items, selectedSources]);

  function toggleSource(source: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  const groupedItems = React.useMemo(() => {
    const groups = new Map<
      string,
      { key: string; owner?: MetricCatalogItem['owner']; items: MetricCatalogItem[]; pointsSum: number }
    >();
    for (const it of filteredItems) {
      const k = sourceKey(it.owner);
      const g = groups.get(k) || { key: k, owner: it.owner, items: [], pointsSum: 0 };
      // Prefer first non-empty owner metadata
      if (!g.owner && it.owner) g.owner = it.owner;
      g.items.push(it);
      g.pointsSum += Number(it.pointsCount || 0) || 0;
      groups.set(k, g);
    }

    const out = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
    for (const g of out) g.items.sort((a, b) => a.key.localeCompare(b.key));
    return out;
  }, [filteredItems]);

  function toggleGroup(k: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="text-muted-foreground">
            All known metrics (feature packs + app config + DB-defined), plus live data coverage from ingested points.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}

      {availableSources.length > 0 && (
        <Card title="Filter by Source" description="Select one or more sources to filter metrics.">
          <div className="flex flex-wrap gap-3">
            {availableSources.map((source) => {
              const isSelected = selectedSources.has(source);
              const owner = items.find((item) => {
                const itemSource = item.owner?.kind === 'feature_pack'
                  ? `fp:${item.owner.id}`
                  : item.owner?.kind === 'app'
                    ? 'app'
                    : item.owner?.kind === 'user'
                      ? 'user'
                      : '—';
                return itemSource === source;
              })?.owner;
              
              const className =
                owner?.kind === 'feature_pack'
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700'
                  : owner?.kind === 'app'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700'
                    : owner?.kind === 'user'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                      : 'bg-muted text-muted-foreground border-muted';
              
              return (
                <label
                  key={source}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all ${
                    isSelected
                      ? className
                      : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSource(source)}
                    className="w-3 h-3 rounded border-gray-300 text-current focus:ring-2 focus:ring-current"
                  />
                  <SourceChip
                    owner={owner}
                  />
                </label>
              );
            })}
          </div>
        </Card>
      )}

      <Card
        title={`Configured metrics (${filteredItems.length}${filteredItems.length !== items.length ? ` of ${items.length}` : ''})`}
        description="Read-only. Configure metrics via feature-pack.yaml or .hit/metrics/definitions and run `hit run`."
      >
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {items.length === 0 ? 'No definitions yet.' : 'No metrics match the selected filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Tip: this view is now grouped by source/owner to reduce noise.
              </div>
              <div className="flex items-center gap-2">
                <Button variant={groupedView ? 'primary' : 'secondary'} onClick={() => setGroupedView(true)}>
                  Grouped
                </Button>
                <Button variant={!groupedView ? 'primary' : 'secondary'} onClick={() => setGroupedView(false)}>
                  Flat
                </Button>
              </div>
            </div>

            {groupedView ? (
              <div className="space-y-3">
                {groupedItems.map((g) => {
                  const isOpen = expandedGroups.has(g.key);
                  return (
                    <div key={g.key} className="border rounded-lg">
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.key)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <SourceChip owner={g.owner} />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{sourceLabel(g.owner)}</div>
                            <div className="text-xs text-muted-foreground">
                              {g.items.length} metric{g.items.length === 1 ? '' : 's'} · {g.pointsSum.toLocaleString()} points
                            </div>
                          </div>
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="overflow-x-auto border-t">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="py-3 pr-4 pl-4 font-medium">Source</th>
                                <th className="py-3 pr-4 font-medium">Metric Key</th>
                                <th className="py-3 pr-4 font-medium">Label</th>
                                <th className="py-3 pr-4 font-medium">Unit</th>
                                <th className="py-3 pr-4 font-medium">Rollup</th>
                                <th className="py-3 pr-4 font-medium">Granularity</th>
                                <th className="py-3 pr-4 font-medium text-right">Points</th>
                                <th className="py-3 pr-4 font-medium">First</th>
                                <th className="py-3 pr-4 font-medium">Last</th>
                                <th className="py-3 pr-4 font-medium">Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map((d) => (
                                <tr key={d.key} className="border-b hover:bg-muted/50 transition-colors">
                                  <td className="py-3 pr-4 pl-4">
                                    <div className="flex items-center gap-2">
                                      <SourceChip owner={d.owner} />
                                      <span className="text-xs text-muted-foreground">{sourceLabel(d.owner)}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{d.key}</code>
                                  </td>
                                  <td className="py-3 pr-4 font-medium">{d.label}</td>
                                  <td className="py-3 pr-4">
                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                      {d.unit}
                                    </span>
                                  </td>
                                  <td className="py-3 pr-4 text-muted-foreground">{d.rollup_strategy || '—'}</td>
                                  <td className="py-3 pr-4 text-muted-foreground">
                                    {d.time_kind === 'realtime' ? (
                                      <span className="inline-flex items-center rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300">
                                        realtime
                                      </span>
                                    ) : d.time_kind === 'none' ? (
                                      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                                        n/a
                                      </span>
                                    ) : d.default_granularity ? (
                                      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                                        {d.default_granularity}
                                        {Array.isArray(d.allowed_granularities) && d.allowed_granularities.length > 0 ? (
                                          <span className="ml-1 text-slate-500 dark:text-slate-400">
                                            ({d.allowed_granularities.join(',')})
                                          </span>
                                        ) : null}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 text-right tabular-nums">
                                    {d.time_kind === 'realtime' ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : d.pointsCount > 0 ? (
                                      <span className="text-green-600 dark:text-green-400 font-medium">{d.pointsCount.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-muted-foreground">0</span>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                                    {d.time_kind === 'realtime' ? '—' : d.firstPointAt ? new Date(d.firstPointAt).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                                    {d.time_kind === 'realtime' ? '—' : d.lastPointAt ? new Date(d.lastPointAt).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                                    {d.time_kind === 'realtime' ? '—' : formatTimeAgo(d.lastUpdatedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Source</th>
                      <th className="py-3 pr-4 font-medium">Metric Key</th>
                      <th className="py-3 pr-4 font-medium">Label</th>
                      <th className="py-3 pr-4 font-medium">Unit</th>
                      <th className="py-3 pr-4 font-medium">Rollup</th>
                      <th className="py-3 pr-4 font-medium">Granularity</th>
                      <th className="py-3 pr-4 font-medium text-right">Points</th>
                      <th className="py-3 pr-4 font-medium">First</th>
                      <th className="py-3 pr-4 font-medium">Last</th>
                      <th className="py-3 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems
                      .slice()
                      .sort((a, b) => a.key.localeCompare(b.key))
                      .map((d) => (
                        <tr key={d.key} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <SourceChip owner={d.owner} />
                              <span className="text-xs text-muted-foreground">{sourceLabel(d.owner)}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{d.key}</code>
                          </td>
                          <td className="py-3 pr-4 font-medium">{d.label}</td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {d.unit}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{d.rollup_strategy || '—'}</td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {d.time_kind === 'realtime' ? (
                              <span className="inline-flex items-center rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300">
                                realtime
                              </span>
                            ) : d.time_kind === 'none' ? (
                              <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                                n/a
                              </span>
                            ) : d.default_granularity ? (
                              <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                                {d.default_granularity}
                                {Array.isArray(d.allowed_granularities) && d.allowed_granularities.length > 0 ? (
                                  <span className="ml-1 text-slate-500 dark:text-slate-400">
                                    ({d.allowed_granularities.join(',')})
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {d.time_kind === 'realtime' ? (
                              <span className="text-muted-foreground">—</span>
                            ) : d.pointsCount > 0 ? (
                              <span className="text-green-600 dark:text-green-400 font-medium">{d.pointsCount.toLocaleString()}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                            {d.time_kind === 'realtime' ? '—' : d.firstPointAt ? new Date(d.firstPointAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                            {d.time_kind === 'realtime' ? '—' : d.lastPointAt ? new Date(d.lastPointAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 text-muted-foreground tabular-nums">
                            {d.time_kind === 'realtime' ? '—' : formatTimeAgo(d.lastUpdatedAt)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default Definitions;


