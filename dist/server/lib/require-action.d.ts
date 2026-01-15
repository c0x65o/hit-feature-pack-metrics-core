import type { ActionCheckResult } from '@hit/feature-pack-auth-core/server/lib/action-check';
export declare function checkMetricsCoreAction(request: Request, actionKey: string): Promise<ActionCheckResult>;
export declare function requireMetricsCoreAction(request: Request, actionKey: string): Promise<Response | null>;
//# sourceMappingURL=require-action.d.ts.map