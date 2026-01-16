import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
export function loadPartnerDefinitions(cwd = process.cwd()) {
    // Preferred schema-driven location:
    //   schema/metrics/partners/*.yaml
    // Legacy fallback:
    //   .hit/metrics/partners/*.yaml
    const schemaDir = path.join(cwd, 'schema', 'metrics', 'partners');
    const legacyDir = path.join(cwd, '.hit', 'metrics', 'partners');
    const dirs = [schemaDir, legacyDir].filter((d) => fs.existsSync(d));
    if (!dirs.length)
        return [];
    // Merge by id; schema wins over legacy on collisions.
    const byId = new Map();
    for (const dir of dirs) {
        for (const entry of fs.readdirSync(dir)) {
            if (!entry.endsWith('.yaml') && !entry.endsWith('.yml'))
                continue;
            const filePath = path.join(dir, entry);
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = yaml.load(raw);
            if (!isPlainObject(parsed))
                continue;
            const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
            const label = typeof parsed.label === 'string' ? parsed.label.trim() : '';
            if (!id || !label)
                continue;
            const fieldsRaw = parsed.fields ?? [];
            const fields = Array.isArray(fieldsRaw)
                ? fieldsRaw
                    .map((f) => {
                    if (!isPlainObject(f))
                        return null;
                    const key = typeof f.key === 'string' ? f.key.trim() : '';
                    const flabel = typeof f.label === 'string' ? f.label.trim() : '';
                    const type = typeof f.type === 'string' ? f.type.trim() : 'text';
                    if (!key || !flabel)
                        return null;
                    if (!['text', 'secret', 'number', 'json'].includes(type))
                        return null;
                    return {
                        key,
                        label: flabel,
                        type,
                        required: f.required === true,
                        description: typeof f.description === 'string' ? f.description : undefined,
                    };
                })
                    .filter(Boolean)
                : [];
            const verifyRaw = parsed.verify ?? undefined;
            let verify;
            if (isPlainObject(verifyRaw) && typeof verifyRaw.kind === 'string') {
                if (verifyRaw.kind === 'http' && typeof verifyRaw.url === 'string') {
                    verify = {
                        kind: 'http',
                        method: (verifyRaw.method === 'POST' ? 'POST' : 'GET'),
                        url: verifyRaw.url,
                        headers: isPlainObject(verifyRaw.headers) ? verifyRaw.headers : undefined,
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
            byId.set(id, {
                id,
                label,
                description: typeof parsed.description === 'string' ? parsed.description : undefined,
                fields,
                verify,
            });
        }
    }
    return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}
export function interpolateTemplate(template, creds) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        const v = creds[key];
        if (v === null || v === undefined)
            return '';
        return encodeURIComponent(String(v));
    });
}
