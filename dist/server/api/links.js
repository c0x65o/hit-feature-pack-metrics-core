import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsLinks } from '@/lib/feature-pack-schemas';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function cryptoRandomId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
export async function GET(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const url = new URL(request.url);
    const linkType = (url.searchParams.get('linkType') || '').trim();
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '200'), 1), 500);
    const db = getDb();
    const conditions = [];
    if (linkType)
        conditions.push(eq(metricsLinks.linkType, linkType));
    if (q)
        conditions.push(ilike(metricsLinks.linkId, `%${q}%`));
    let query = db.select().from(metricsLinks);
    if (conditions.length > 0)
        query = query.where(and(...conditions));
    const rows = await query.orderBy(sql `${metricsLinks.updatedAt} DESC`).limit(limit);
    return NextResponse.json({ data: rows });
}
export async function POST(request) {
    const auth = getAuthContext(request);
    if (!auth)
        return jsonError('Unauthorized', 401);
    const body = (await request.json().catch(() => null));
    if (!body)
        return jsonError('Invalid JSON body', 400);
    const linkType = typeof body.linkType === 'string' ? body.linkType.trim() : '';
    const linkId = typeof body.linkId === 'string' ? body.linkId.trim() : '';
    if (!linkType)
        return jsonError('Missing linkType', 400);
    if (!linkId)
        return jsonError('Missing linkId', 400);
    const targetKind = typeof body.targetKind === 'string' ? body.targetKind.trim() : 'none';
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
    const metadata = typeof body.metadata === 'object' ? body.metadata : null;
    const now = new Date();
    const id = `mlink_${cryptoRandomId()}`;
    const db = getDb();
    const [created] = await db
        .insert(metricsLinks)
        .values({
        id,
        linkType,
        linkId,
        targetKind: targetKind || 'none',
        targetId,
        metadata,
        createdAt: now,
        updatedAt: now,
    })
        .returning();
    return NextResponse.json({ data: created }, { status: 201 });
}
