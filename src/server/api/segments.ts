import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsSegments } from '@/lib/feature-pack-schemas';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireAdminOrService(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return { ok: false as const, res: jsonError('Unauthorized', 401) };
  if (auth.kind === 'service') return { ok: true as const };
  const roles = Array.isArray(auth.user.roles) ? auth.user.roles : [];
  if (!roles.includes('admin')) return { ok: false as const, res: jsonError('Forbidden', 403) };
  return { ok: true as const };
}

function makeId(prefix = 'seg') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type SegmentRule = Record<string, unknown> & { kind?: string };

function normalizeKey(key: unknown): string {
  return typeof key === 'string' ? key.trim() : '';
}

export async function GET(request: NextRequest) {
  const gate = requireAdminOrService(request);
  if (!gate.ok) return gate.res;

  const url = new URL(request.url);
  const entityKind = (url.searchParams.get('entityKind') || '').trim();
  const q = (url.searchParams.get('q') || '').trim();
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const db = getDb();
  const where: any[] = [];
  if (entityKind) where.push(eq(metricsSegments.entityKind, entityKind));
  if (!includeInactive) where.push(eq(metricsSegments.isActive, true));
  if (q) {
    // naive search across key/label/description
    where.push(
      or(
        ilike(metricsSegments.key, `%${q}%`),
        ilike(metricsSegments.label, `%${q}%`),
        ilike(metricsSegments.description, `%${q}%`)
      )
    );
  }

  const rows = where.length
    ? await db.select().from(metricsSegments).where(and(...where)).orderBy(asc(metricsSegments.key))
    : await db.select().from(metricsSegments).orderBy(asc(metricsSegments.key));

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  const gate = requireAdminOrService(request);
  if (!gate.ok) return gate.res;

  const body = (await request.json().catch(() => null)) as
    | {
        key?: unknown;
        entityKind?: unknown;
        label?: unknown;
        description?: unknown;
        rule?: unknown;
        isActive?: unknown;
      }
    | null;
  if (!body) return jsonError('Invalid JSON body', 400);

  const key = normalizeKey(body.key);
  const entityKind = typeof body.entityKind === 'string' ? body.entityKind.trim() : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const description = typeof body.description === 'string' ? body.description : null;
  const rule = (body.rule && typeof body.rule === 'object' ? body.rule : null) as SegmentRule | null;
  const isActive = body.isActive === false ? false : true;

  if (!key) return jsonError('Missing key', 400);
  if (!entityKind) return jsonError('Missing entityKind', 400);
  if (!label) return jsonError('Missing label', 400);
  if (!rule || !rule.kind || typeof rule.kind !== 'string') return jsonError('Missing rule.kind', 400);

  const db = getDb();
  const existing = await db.select({ key: metricsSegments.key }).from(metricsSegments).where(eq(metricsSegments.key, key)).limit(1);
  if (existing.length) return jsonError('Segment key already exists', 409);

  const now = new Date();
  const id = makeId('seg');
  const row = {
    id,
    key,
    entityKind,
    label,
    description,
    rule,
    isActive,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(metricsSegments).values(row as any);
  return NextResponse.json({ data: row }, { status: 201 });
}


