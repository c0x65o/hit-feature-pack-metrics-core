import { checkMetricsCoreAction } from './require-action';
/**
 * Resolve effective scope mode using a tree:
 * - metrics-core default: metrics-core.{verb}.scope.{mode}
 * - entity override: metrics-core.{entity}.{verb}.scope.{mode}
 * - fallback: own
 *
 * Precedence if multiple are granted: most restrictive wins.
 */
export async function resolveMetricsCoreScopeMode(request, args) {
    const { verb, entity } = args;
    // Try entity-specific override first (if provided)
    if (entity) {
        const entityPrefix = `metrics-core.${entity}.${verb}.scope`;
        const modes = ['none', 'own', 'ldd', 'any'];
        for (const m of modes) {
            const res = await checkMetricsCoreAction(request, `${entityPrefix}.${m}`);
            if (res.ok)
                return m;
        }
    }
    // Fall back to global metrics-core scope
    const globalPrefix = `metrics-core.${verb}.scope`;
    const modes = ['none', 'own', 'ldd', 'any'];
    for (const m of modes) {
        const res = await checkMetricsCoreAction(request, `${globalPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    return 'own';
}
