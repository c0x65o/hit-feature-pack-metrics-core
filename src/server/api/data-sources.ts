import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsDataSources } from '@/lib/feature-pack-schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(metricsDataSources);
  return NextResponse.json({ data: rows });
}
