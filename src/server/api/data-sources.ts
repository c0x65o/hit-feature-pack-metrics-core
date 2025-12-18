import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsDataSources } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getAuthContext } from '../lib/authz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(metricsDataSources);
  return NextResponse.json({ data: rows });
}
