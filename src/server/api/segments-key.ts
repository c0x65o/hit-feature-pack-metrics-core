import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsSegments } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
import { resolveMetricsCoreScopeMode } from '../lib/scope-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type RouteParams = { params: { key: string } };

type SegmentRule = Record<string, unknown> & { kind?: string };

export async function GET(request: NextRequest, ctx: RouteParams) {
  const auth = getAuthContext(request);
  if (!auth || auth.kind !== 'user') return jsonError('Unauthorized', 401);

  // Resolve scope mode for read access
  const mode = await resolveMetricsCoreScopeMode(request, { verb: 'read', entity: 'segments' });

  // Apply scope-based filtering (explicit branching on none/own/ldd/any)
  if (mode === 'none') {
    return jsonError('Not found', 404);
  } else if (mode === 'own' || mode === 'ldd') {
    // Metrics-core doesn't have ownership or LDD fields, so deny access
    return jsonError('Not found', 404);
  } else if (mode !== 'any') {
    // Fallback: deny access
    return jsonError('Not found', 404);
  }

  const key = String(ctx?.params?.key || '').trim();
  if (!key) return jsonError('Missing key', 400);

  const db = getDb();
  const rows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
  if (!rows.length) return jsonError('Not found', 404);
  return NextResponse.json({ data: rows[0] });
}

export async function PUT(request: NextRequest, ctx: RouteParams) {
  const auth = getAuthContext(request);
  if (!auth || auth.kind !== 'user') return jsonError('Unauthorized', 401);

  // Resolve scope mode for write access
  const mode = await resolveMetricsCoreScopeMode(request, { verb: 'write', entity: 'segments' });

  // Apply scope-based filtering (explicit branching on none/own/ldd/any)
  if (mode === 'none') {
    return jsonError('Forbidden', 403);
  } else if (mode === 'own' || mode === 'ldd') {
    // Metrics-core doesn't have ownership or LDD fields, so deny access
    return jsonError('Forbidden', 403);
  } else if (mode !== 'any') {
    // Fallback: deny access
    return jsonError('Forbidden', 403);
  }

  const key = String(ctx?.params?.key || '').trim();
  if (!key) return jsonError('Missing key', 400);

  const body = (await request.json().catch(() => null)) as
    | { label?: unknown; description?: unknown; rule?: unknown; isActive?: unknown }
    | null;
  if (!body) return jsonError('Invalid JSON body', 400);

  const next: any = {};
  if (typeof body.label === 'string') next.label = body.label.trim();
  if (typeof body.description === 'string') next.description = body.description;
  if (body.description === null) next.description = null;
  if (typeof body.isActive === 'boolean') next.isActive = body.isActive;

  if (body.rule !== undefined) {
    const rule = (body.rule && typeof body.rule === 'object' ? body.rule : null) as SegmentRule | null;
    if (!rule || !rule.kind || typeof rule.kind !== 'string') return jsonError('Missing rule.kind', 400);
    next.rule = rule;
  }

  if (Object.keys(next).length === 0) return jsonError('No fields to update', 400);
  next.updatedAt = new Date();

  const db = getDb();
  const exists = await db.select({ key: metricsSegments.key }).from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
  if (!exists.length) return jsonError('Not found', 404);

  await db.update(metricsSegments).set(next).where(eq(metricsSegments.key, key));
  const rows = await db.select().from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
  return NextResponse.json({ data: rows[0] });
}

export async function DELETE(request: NextRequest, ctx: RouteParams) {
  const auth = getAuthContext(request);
  if (!auth || auth.kind !== 'user') return jsonError('Unauthorized', 401);

  // Resolve scope mode for delete access
  const mode = await resolveMetricsCoreScopeMode(request, { verb: 'delete', entity: 'segments' });

  // Apply scope-based filtering (explicit branching on none/own/ldd/any)
  if (mode === 'none') {
    return jsonError('Forbidden', 403);
  } else if (mode === 'own' || mode === 'ldd') {
    // Metrics-core doesn't have ownership or LDD fields, so deny access
    return jsonError('Forbidden', 403);
  } else if (mode !== 'any') {
    // Fallback: deny access
    return jsonError('Forbidden', 403);
  }

  const key = String(ctx?.params?.key || '').trim();
  if (!key) return jsonError('Missing key', 400);

  const db = getDb();
  const exists = await db.select({ key: metricsSegments.key }).from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
  if (!exists.length) return jsonError('Not found', 404);

  await db.delete(metricsSegments).where(eq(metricsSegments.key, key));
  return new NextResponse(null, { status: 204 });
}


