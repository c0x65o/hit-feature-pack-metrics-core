import crypto from 'crypto';
/**
 * Compute a stable hash for a dimensions object so we can enforce uniqueness
 * across (metricKey, date, granularity, dimensions).
 */
export function computeDimensionsHash(dimensions) {
    if (!dimensions || typeof dimensions !== 'object')
        return 'null';
    const entries = Object.entries(dimensions)
        .filter(([k]) => k != null && k !== '')
        .map(([k, v]) => [String(k), v])
        .sort(([a], [b]) => a.localeCompare(b));
    const normalized = entries
        .map(([k, v]) => {
        if (v === null || v === undefined)
            return `${k}:null`;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
            return `${k}:${String(v)}`;
        return `${k}:${JSON.stringify(v)}`;
    })
        .join('|');
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 64);
}
