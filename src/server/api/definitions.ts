import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsMetricDefinitions } from '@/lib/feature-pack-schemas';
import { extractUserFromRequest } from '../auth';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const db = getDb();
  const defs = await db.select().from(metricsMetricDefinitions);
  return NextResponse.json({ data: defs });
}

export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) return jsonError('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError('Invalid JSON body', 400);

  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim() : 'count';

  if (!key) return jsonError('Missing key', 400);
  if (!label) return jsonError('Missing label', 400);

  const now = new Date();
  const id = `mdef_${cryptoRandomId()}`;

  const db = getDb();

  // If key exists, upsert-like behavior is intentionally NOT provided here.
  const existing = await db.select({ id: metricsMetricDefinitions.id }).from(metricsMetricDefinitions).where(eq(metricsMetricDefinitions.key, key)).limit(1);
  if (existing.length > 0) {
    return jsonError(`Metric definition already exists for key: ${key}`, 409);
  }

  const [created] = await db
    .insert(metricsMetricDefinitions)
    .values({
      id,
      key,
      label,
      description: typeof body.description === 'string' ? body.description : null,
      unit,
      category: typeof body.category === 'string' ? body.category : null,
      defaultGranularity: typeof body.defaultGranularity === 'string' ? body.defaultGranularity : 'daily',
      allowedGranularities: typeof body.allowedGranularities === 'object' ? (body.allowedGranularities as any) : null,
      dimensionsSchema: typeof body.dimensionsSchema === 'object' ? (body.dimensionsSchema as any) : null,
      validationRules: typeof body.validationRules === 'object' ? (body.validationRules as any) : null,
      rollupStrategy: typeof body.rollupStrategy === 'string' ? body.rollupStrategy : 'sum',
      isActive: body.isActive === false ? false : true,
      sortOrder: typeof body.sortOrder === 'number' ? String(body.sortOrder) : '0',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ data: created }, { status: 201 });
}

function cryptoRandomId(): string {
  // Avoid importing node:crypto here to keep bundling simple; Math.random is fine pre-1.0 for IDs.
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}


