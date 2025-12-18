import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricPoints } from '@/lib/feature-pack-schemas';
import { computeDimensionsHash } from '../lib/dimensions';
import { sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type IngestPoint = {
  entityKind: string;
  entityId: string;
  metricKey: string;
  dataSourceId: string;
  date: string;
  granularity?: string;
  value: number | string;
  dimensions?: Record<string, unknown> | null;
  syncRunId?: string | null;
  ingestBatchId?: string | null;
};

export async function POST(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return jsonError('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as { points?: unknown } | null;
  if (!body || !Array.isArray(body.points)) return jsonError('Body must include points: []', 400);

  const now = new Date();
  const values: any[] = [];

  for (const p of body.points as IngestPoint[]) {
    if (!p || typeof p !== 'object') continue;
    if (!p.entityKind || !p.entityId || !p.metricKey || !p.dataSourceId || !p.date) continue;

    const d = new Date(p.date);
    if (Number.isNaN(d.getTime())) continue;

    const dimensions = p.dimensions && typeof p.dimensions === 'object' ? p.dimensions : null;
    const dimensionsHash = computeDimensionsHash(dimensions);

    values.push({
      id: `mp_${cryptoRandomId()}`,
      entityKind: String(p.entityKind),
      entityId: String(p.entityId),
      metricKey: String(p.metricKey),
      dataSourceId: String(p.dataSourceId),
      syncRunId: p.syncRunId ? String(p.syncRunId) : null,
      ingestBatchId: p.ingestBatchId ? String(p.ingestBatchId) : null,
      date: d,
      granularity: p.granularity ? String(p.granularity) : 'daily',
      value: String(p.value),
      dimensions,
      dimensionsHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (values.length === 0) return jsonError('No valid points provided', 400);

  const db = getDb();

  // Upsert via unique constraint (dataSourceId, metricKey, date, granularity, dimensionsHash).
  // On conflict we update value + provenance + updatedAt.
  await db
    .insert(metricsMetricPoints)
    .values(values)
    .onConflictDoUpdate({
      target: [
        metricsMetricPoints.dataSourceId,
        metricsMetricPoints.metricKey,
        metricsMetricPoints.date,
        metricsMetricPoints.granularity,
        metricsMetricPoints.dimensionsHash,
      ],
      set: {
        value: sql`excluded.value`,
        syncRunId: sql`excluded.sync_run_id`,
        ingestBatchId: sql`excluded.ingest_batch_id`,
        updatedAt: now,
      } as any,
    });

  return NextResponse.json({ success: true, received: (body.points as any[]).length, ingested: values.length });
}

function cryptoRandomId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}


