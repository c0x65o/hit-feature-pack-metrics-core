export declare function normalizeReportTimezone(tz: unknown): string;
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
export declare function getAppReportTimezone(): Promise<string>;
//# sourceMappingURL=reporting.d.ts.map