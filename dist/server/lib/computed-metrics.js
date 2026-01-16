/**
 * Computed metrics module.
 *
 * This module provides fallback support for metrics that are declared in the catalog
 * but not stored as points. Instead, they are computed on-the-fly from source tables.
 */
/**
 * Try to run a computed metric query.
 * Returns null if the metric is not a computed metric or if computation is not supported.
 */
export async function tryRunComputedMetricQuery(args) {
    // Stub implementation: return null to indicate no computed metric support
    // This allows the code to fall back to the points query path
    return null;
}
/**
 * Try to run a computed metric drilldown query.
 * Returns null if the metric is not a computed metric or if computation is not supported.
 */
export async function tryRunComputedMetricDrilldown(args) {
    // Stub implementation: return null to indicate no computed metric support
    // This allows the code to fall back to the points query path
    return null;
}
