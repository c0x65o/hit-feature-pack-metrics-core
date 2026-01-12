import type { NextRequest } from 'next/server';
import { checkMetricsCoreAction } from './require-action';

export type ScopeMode = 'none' | 'own' | 'ldd' | 'any';
export type ScopeVerb = 'read' | 'write' | 'delete';

/**
 * Resolve effective scope mode using a tree:
 * - metrics-core default: metrics-core.{verb}.scope.{mode}
 * - entity override: metrics-core.{entity}.{verb}.scope.{mode}
 * - fallback: own
 *
 * Precedence if multiple are granted: most restrictive wins.
 */
export async function resolveMetricsCoreScopeMode(
  request: NextRequest,
  args: { verb: ScopeVerb; entity?: string }
): Promise<ScopeMode> {
  const { verb, entity } = args;
  
  // Try entity-specific override first (if provided)
  if (entity) {
    const entityPrefix = `metrics-core.${entity}.${verb}.scope`;
    const modes: ScopeMode[] = ['none', 'own', 'ldd', 'any'];
    
    for (const m of modes) {
      const res = await checkMetricsCoreAction(request, `${entityPrefix}.${m}`);
      if (res.ok) return m;
    }
  }
  
  // Fall back to global metrics-core scope
  const globalPrefix = `metrics-core.${verb}.scope`;
  const modes: ScopeMode[] = ['none', 'own', 'ldd', 'any'];

  for (const m of modes) {
    const res = await checkMetricsCoreAction(request, `${globalPrefix}.${m}`);
    if (res.ok) return m;
  }

  return 'own';
}
