import React, { useEffect, useState } from 'react';
import { useUi } from '@hit/ui-kit';

type SegmentRow = {
  id: string;
  key: string;
  entityKind: string;
  label: string;
  description: string | null;
  rule: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function safeJsonParse(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

export function SegmentEdit(props: { key?: string; onNavigate?: (path: string) => void }) {
  const { Page, Card, Button, Input, TextArea, Select } = useUi();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segmentKeyFromRoute, setSegmentKeyFromRoute] = useState<string>('');
  const [key, setKey] = useState('');
  const [entityKind, setEntityKind] = useState('project');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [ruleText, setRuleText] = useState(
    JSON.stringify(
      {
        kind: 'metric_threshold',
        metricKey: 'revenue_usd',
        agg: 'sum',
        op: '>=',
        value: 100000,
      },
      null,
      2
    )
  );
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Extract key from URL pathname (similar to ProviderDetail pattern)
  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const segmentsIdx = parts.indexOf('segments');
    if (segmentsIdx >= 0 && parts[segmentsIdx + 1] === 'new') {
      setSegmentKeyFromRoute('');
    } else if (segmentsIdx >= 0 && parts[segmentsIdx + 2] === 'edit') {
      setSegmentKeyFromRoute(decodeURIComponent(parts[segmentsIdx + 1] || ''));
    }
  }, []);

  const editingKey = props.key || segmentKeyFromRoute || null;
  const isEditMode = Boolean(editingKey);

  const navigate = (path: string) => {
    if (props.onNavigate) props.onNavigate(path);
    else window.location.href = path;
  };

  useEffect(() => {
    if (isEditMode && editingKey) {
      loadSegment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentKeyFromRoute]);

  async function loadSegment() {
    if (!editingKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics/segments/${encodeURIComponent(editingKey)}`, { method: 'GET' });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || `Failed to load segment (${res.status})`);
      const segment = json?.data as SegmentRow;
      if (segment) {
        setKey(segment.key);
        setEntityKind(segment.entityKind);
        setLabel(segment.label);
        setDescription(segment.description || '');
        setIsActive(Boolean(segment.isActive));
        setRuleText(JSON.stringify(segment.rule ?? { kind: 'metric_threshold' }, null, 2));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load segment');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const parsed = safeJsonParse(ruleText);
    if (!parsed.ok) {
      setError(`Rule JSON error: ${parsed.error}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!editingKey) {
        const res = await fetch('/api/metrics/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            entityKind,
            label,
            description: description.trim() ? description : null,
            rule: parsed.value,
            isActive,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Failed to create (${res.status})`);
      } else {
        const res = await fetch(`/api/metrics/segments/${encodeURIComponent(editingKey)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label,
            description: description.trim() ? description : null,
            rule: parsed.value,
            isActive,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Failed to update (${res.status})`);
      }
      navigate('/metrics/segments');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page
      title={isEditMode ? 'Edit Segment' : 'New Segment'}
      description="Segments are reusable selection rules. Store a stable key so other systems can reference it."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="ghost" onClick={() => navigate('/metrics/segments')} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            loading={saving}
            disabled={loading || !key.trim() || !label.trim() || !entityKind.trim()}
          >
            Save
          </Button>
        </div>
      }
    >
      <Card>
        {error ? <div style={{ marginBottom: '12px', color: 'var(--hit-error, #ef4444)' }}>{error}</div> : null}

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Key"
              value={key}
              onChange={setKey}
              placeholder="segment.project.revenue_gte_100k_all_time"
              required
              disabled={Boolean(editingKey)}
            />
            <Input label="Label" value={label} onChange={setLabel} placeholder="High Revenue Projects" required />
            <Select
              label="Entity Kind"
              value={entityKind}
              onChange={setEntityKind}
              options={[{ value: 'project', label: 'Project' }]}
              required
              disabled={Boolean(editingKey)}
            />
            <Input label="Description" value={description} onChange={setDescription} placeholder="Optional" />

            <TextArea
              label="Rule (JSON)"
              value={ruleText}
              onChange={setRuleText}
              rows={12}
              placeholder='{"kind":"metric_threshold","metricKey":"revenue_usd","agg":"sum","op":">=","value":100000}'
            />

            <Select
              label="Status"
              value={isActive ? 'active' : 'inactive'}
              onChange={(v: string) => setIsActive(v === 'active')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
        )}
      </Card>
    </Page>
  );
}

export default SegmentEdit;

