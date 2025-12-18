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
export declare function main(): Promise<void>;
//# sourceMappingURL=metrics-backfill.d.ts.map