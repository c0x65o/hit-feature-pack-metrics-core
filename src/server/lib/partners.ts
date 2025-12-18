import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

export type PartnerFieldType = 'text' | 'secret' | 'number' | 'json';

export type PartnerFieldDefinition = {
  key: string;
  label: string;
  type: PartnerFieldType;
  required?: boolean;
  description?: string;
};

export type PartnerVerifyConfig =
  | {
      kind: 'http';
      method?: 'GET' | 'POST';
      url: string; // supports {{field_key}} interpolation
      headers?: Record<string, string>; // supports {{field_key}} interpolation
    }
  | {
      kind: 'command';
      command: string; // executed via: bash -lc "<command>"
      envPrefix?: string; // default: HIT_PARTNER_
    };

export type PartnerDefinition = {
  id: string;
  label: string;
  description?: string;
  fields: PartnerFieldDefinition[];
  verify?: PartnerVerifyConfig;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function loadPartnerDefinitions(cwd = process.cwd()): PartnerDefinition[] {
  const dir = path.join(cwd, '.hit', 'metrics', 'partners');
  if (!fs.existsSync(dir)) return [];

  const out: PartnerDefinition[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
    const filePath = path.join(dir, entry);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(raw) as unknown;
    if (!isPlainObject(parsed)) continue;

    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const label = typeof parsed.label === 'string' ? parsed.label.trim() : '';
    if (!id || !label) continue;

    const fieldsRaw = (parsed.fields as unknown) ?? [];
    const fields: PartnerFieldDefinition[] = Array.isArray(fieldsRaw)
      ? fieldsRaw
          .map((f) => {
            if (!isPlainObject(f)) return null;
            const key = typeof f.key === 'string' ? f.key.trim() : '';
            const flabel = typeof f.label === 'string' ? f.label.trim() : '';
            const type = typeof f.type === 'string' ? (f.type.trim() as PartnerFieldType) : 'text';
            if (!key || !flabel) return null;
            if (!['text', 'secret', 'number', 'json'].includes(type)) return null;
            return {
              key,
              label: flabel,
              type,
              required: f.required === true,
              description: typeof f.description === 'string' ? f.description : undefined,
            } satisfies PartnerFieldDefinition;
          })
          .filter(Boolean) as PartnerFieldDefinition[]
      : [];

    const verifyRaw = (parsed.verify as unknown) ?? undefined;
    let verify: PartnerVerifyConfig | undefined;
    if (isPlainObject(verifyRaw) && typeof verifyRaw.kind === 'string') {
      if (verifyRaw.kind === 'http' && typeof verifyRaw.url === 'string') {
        verify = {
          kind: 'http',
          method: (verifyRaw.method === 'POST' ? 'POST' : 'GET') as 'GET' | 'POST',
          url: verifyRaw.url,
          headers: isPlainObject(verifyRaw.headers) ? (verifyRaw.headers as Record<string, string>) : undefined,
        };
      }
      if (verifyRaw.kind === 'command' && typeof verifyRaw.command === 'string') {
        verify = {
          kind: 'command',
          command: verifyRaw.command,
          envPrefix: typeof verifyRaw.envPrefix === 'string' ? verifyRaw.envPrefix : undefined,
        };
      }
    }

    out.push({
      id,
      label,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      fields,
      verify,
    });
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function interpolateTemplate(template: string, creds: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = creds[key];
    if (v === null || v === undefined) return '';
    return encodeURIComponent(String(v));
  });
}


