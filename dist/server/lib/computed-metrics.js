/**
 * Computed metrics (feature-pack owned):
 *
 * metrics-core is intentionally pack-agnostic. Any computed-metric implementation
 * must live in the owning feature pack and be registered/injected by the app.
 *
 * For now, we return null so callers fall back to stored points.
 */
export async function tryRunComputedMetricQuery(_args) {
    return null;
}
/**
 * Computed drilldown (feature-pack owned):
 *
 * When a metric has no stored points, /api/metrics/drilldown will try this.
 * Returning null means "no computed drilldown available".
 */
export async function tryRunComputedMetricDrilldown(_args) {
    return null;
}
