import type { NextRequest } from 'next/server';
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
export declare function resolveMetricsCoreScopeMode(request: NextRequest, args: {
    verb: ScopeVerb;
    entity?: string;
}): Promise<ScopeMode>;
//# sourceMappingURL=scope-mode.d.ts.map