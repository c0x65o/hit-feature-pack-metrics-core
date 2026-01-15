import type { ActionCheckResult } from '@hit/feature-pack-auth-core/server/lib/action-check';
import {
  checkActionPermission,
  requireActionPermission,
} from '@hit/feature-pack-auth-core/server/lib/action-check';

export async function checkMetricsCoreAction(
  request: Request,
  actionKey: string
): Promise<ActionCheckResult> {
  return checkActionPermission(
    request as Parameters<typeof checkActionPermission>[0],
    actionKey,
    { logPrefix: 'Metrics-Core' }
  );
}

export async function requireMetricsCoreAction(
  request: Request,
  actionKey: string
): Promise<Response | null> {
  return requireActionPermission(
    request as Parameters<typeof requireActionPermission>[0],
    actionKey,
    { logPrefix: 'Metrics-Core' }
  );
}
