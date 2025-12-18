import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsPartnerCredentials } from '@/lib/feature-pack-schemas';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions } from '../lib/partners';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const auth = getAuthContext(request);
  if (!auth) return jsonError('Unauthorized', 401);

  const defs = loadPartnerDefinitions();
  const db = getDb();
  const rows = (await db.select().from(metricsPartnerCredentials)) as Array<{
    id: string;
    enabled: boolean;
    lastVerifiedAt: Date | null;
    lastVerifyOk: boolean | null;
    lastVerifyMessage: string | null;
  }>;
  const byId = new Map<string, (typeof rows)[number]>(rows.map((r) => [r.id, r]));

  const data = defs.map((d) => {
    const row = byId.get(d.id);
    return {
      id: d.id,
      label: d.label,
      description: d.description ?? null,
      fields: d.fields,
      verify: d.verify ?? null,
      configured: !!row,
      enabled: row?.enabled ?? false,
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
      lastVerifyOk: row?.lastVerifyOk ?? null,
      lastVerifyMessage: row?.lastVerifyMessage ?? null,
    };
  });

  const orphans = rows
    .filter((r) => !defs.some((d) => d.id === r.id))
    .map((r) => ({
      id: r.id,
      configured: true,
      enabled: r.enabled,
      lastVerifiedAt: r.lastVerifiedAt ?? null,
      lastVerifyOk: r.lastVerifyOk ?? null,
      lastVerifyMessage: r.lastVerifyMessage ?? null,
    }));

  return NextResponse.json({ data, orphans });
}


