/**
 * metrics-backfill (generic)
 *
 * Reads `metrics.definitions` + `metrics.backfills` from the app's hit.yaml (cwd)
 * and executes a named backfill via metrics-runner.
 *
 * This is intentionally app-agnostic so every app can keep its scripts in `.hit/tasks/`
 * and its configuration in `hit.yaml`, while metrics-core provides the standardized
 * ingestion + registry behavior.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as yaml from 'js-yaml';
function parseArgs(argv) {
    const nameArg = argv.find((a) => a.startsWith('--name='));
    const name = nameArg ? nameArg.split('=')[1] : null;
    if (!name) {
        throw new Error('Missing --name=<backfillName>');
    }
    return { name };
}
async function ensureDefinitions(baseUrl, token, defs) {
    for (const [key, cfg] of Object.entries(defs)) {
        const res = await fetch(`${stripTrailingSlash(baseUrl)}/api/metrics/definitions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-HIT-Service-Token': token,
            },
            body: JSON.stringify({
                key,
                label: cfg.label,
                unit: cfg.unit || 'count',
                category: cfg.category,
                description: cfg.description,
                rollupStrategy: cfg.rollup_strategy || 'sum',
                defaultGranularity: cfg.default_granularity || 'daily',
            }),
        });
        if (res.status === 409)
            continue; // already exists
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Failed to ensure metric definition "${key}" (${res.status}): ${body}`);
        }
    }
}
function runBackfill(baseUrl, token, cfg) {
    const runnerPath = path.join(process.cwd(), 'node_modules', '@hit', 'feature-pack-metrics-core', 'dist', 'cli', 'metrics-runner.js');
    if (!fs.existsSync(runnerPath)) {
        throw new Error(`metrics-runner not found at ${runnerPath}. Did you npm install?`);
    }
    const args = [
        runnerPath,
        '--base-url',
        baseUrl,
        '--service-token',
        token,
        '--data-source-id',
        cfg.data_source_id,
        '--entity-kind',
        cfg.entity_kind,
        '--entity-id',
        cfg.entity_id,
        '--connector-key',
        cfg.connector_key,
        '--source-kind',
        cfg.source_kind,
    ];
    if (cfg.external_ref) {
        args.push('--external-ref', cfg.external_ref);
    }
    args.push('--', 'bash', '-lc', cfg.command);
    const result = spawnSync('node', args, { stdio: 'inherit', env: process.env });
    if (result.status !== 0) {
        throw new Error(`metrics-runner failed with exit code ${result.status}`);
    }
}
export async function main() {
    const { name } = parseArgs(process.argv.slice(2));
    const token = process.env.HIT_SERVICE_TOKEN;
    if (!token)
        throw new Error('Missing HIT_SERVICE_TOKEN env var (required).');
    const baseUrl = process.env.HIT_APP_URL || 'http://localhost:3000';
    const hitYamlPath = path.join(process.cwd(), 'hit.yaml');
    const hitYamlRaw = fs.readFileSync(hitYamlPath, 'utf8');
    const cfg = yaml.load(hitYamlRaw) || {};
    const backfill = cfg.metrics?.backfills?.[name];
    if (!backfill)
        throw new Error(`Backfill not found: metrics.backfills.${name}`);
    const defs = cfg.metrics?.definitions || {};
    if (Object.keys(defs).length > 0) {
        await ensureDefinitions(baseUrl, token, defs);
    }
    runBackfill(baseUrl, token, backfill);
}
function stripTrailingSlash(url) {
    return url.endsWith('/') ? url.slice(0, -1) : url;
}
main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
