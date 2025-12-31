export function normalizeReportTimezone(tz: unknown): string {
  const s = typeof tz === 'string' ? tz.trim() : '';
  return s ? s : 'UTC';
}

/**
 * Read the app-wide reporting timezone from the generated HIT config.
 *
 * - Source of truth: `hit.yaml` -> `reporting.timezone`
 * - Default: "UTC" when missing / unavailable
 *
 * NOTE: This code is compiled as part of the feature-pack package, so it must not
 * import app-local modules (like `@/lib/hit-config.generated`).
 *
 * Instead, we read the runtime-generated config file:
 * - `<app>/public/hit-config.json`
 * which is emitted by `hit run`.
 */
export async function getAppReportTimezone(): Promise<string> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const path = join(process.cwd(), 'public', 'hit-config.json');
    const raw = await readFile(path, 'utf8');
    const cfg = JSON.parse(raw);
    return normalizeReportTimezone(cfg?.reporting?.timezone);
  } catch {
    return 'UTC';
  }
}

