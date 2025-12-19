/**
 * Stub for @/lib/feature-pack-schemas
 *
 * This is a type-only stub for feature pack compilation.
 * At runtime, the consuming application provides the actual implementation
 * via the generated lib/feature-pack-schemas.ts file.
 */
// Re-export schema tables from this feature pack.
// At runtime this is provided by the consuming app; this exists so the pack can compile in isolation.
export { metricsMetricDefinitions, metricsDataSources, metricsSyncRuns, metricsIngestBatches, metricsIngestRowErrors, metricsLinks, metricsPartnerCredentials, metricsMetricPoints, } from '../schema/metrics-core';
// Cross-pack tables that metrics-core may reference in some app integrations.
// In the real application, these are provided by the generated `@/lib/feature-pack-schemas`.
// Here we declare them as `any` so the feature pack can compile in isolation.
//
// IMPORTANT: Do not rely on these being present at runtime unless the consuming app includes
// the corresponding feature packs (e.g. forms, projects).
export const formEntries = undefined;
export const projects = undefined;
