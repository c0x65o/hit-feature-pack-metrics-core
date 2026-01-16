import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { metricsPartnerCredentials } from '@/lib/feature-pack-schemas';
import { getAuthContext } from '../lib/authz';
import { loadPartnerDefinitions, type PartnerDefinition, type PartnerFieldDefinition } from '../lib/partners';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function missingRequiredFields(fields: Array<{ key: string; required?: boolean }>, creds: Record<string, unknown>) {
  const missing: string[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    const v = creds[f.key];
    if (v === null || v === undefined) {
      missing.push(f.key);
      continue;
    }
    if (typeof v === 'string' && !v.trim()) {
      missing.push(f.key);
      continue;
    }
  }
  return missing;
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

  const data = defs.map((d: PartnerDefinition) => {
    const row = byId.get(d.id);
    const creds = (row as any)?.credentials && typeof (row as any).credentials === 'object' ? ((row as any).credentials as Record<string, unknown>) : {};
    const missing = row ? missingRequiredFields(d.fields, creds) : d.fields.filter((f: PartnerFieldDefinition) => !!f.required).map((f: PartnerFieldDefinition) => f.key);
    return {
      id: d.id,
      label: d.label,
      description: d.description ?? null,
      fields: d.fields,
      verify: d.verify ?? null,
      configured: !!row && (row.enabled ?? false) && missing.length === 0,
      enabled: row?.enabled ?? false,
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
      lastVerifyOk: row?.lastVerifyOk ?? null,
      lastVerifyMessage: row?.lastVerifyMessage ?? null,
      missingFields: missing,
    };
  });

  const orphans = rows
    .filter((r) => !defs.some((d: PartnerDefinition) => d.id === r.id))
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


