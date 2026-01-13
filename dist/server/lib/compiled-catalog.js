import fs from 'node:fs';
import path from 'node:path';
export async function loadCompiledMetricsCatalog() {
    // Prefer JSON file written by `hit run` (runtime-stable; avoids Next bundler caching issues).
    try {
        const p = path.join(process.cwd(), '.hit', 'metrics', 'catalog.generated.json');
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object')
                return parsed;
        }
    }
    catch {
        // fall through
    }
    // Fallback to TS module import (older environments).
    try {
        const mod = await import('@/.hit/metrics/catalog.generated');
        const cat = mod?.METRICS_CATALOG;
        if (cat && typeof cat === 'object')
            return cat;
    }
    catch {
        // ignore
    }
    return {};
}
