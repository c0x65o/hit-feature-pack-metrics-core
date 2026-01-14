import { NextRequest, NextResponse } from 'next/server';
import type { ActionCheckResult } from '@hit/feature-pack-auth-core/server/lib/action-check';
import {
  checkActionPermission,
  requireActionPermission,
} from '@hit/feature-pack-auth-core/server/lib/action-check';

export async function checkMetricsCoreAction(
  request: NextRequest,
  actionKey: string
): Promise<ActionCheckResult> {
  return checkActionPermission(request, actionKey, { logPrefix: 'Metrics-Core' });
}

export async function requireMetricsCoreAction(
  request: NextRequest,
  actionKey: string
): Promise<NextResponse | null> {
  return requireActionPermission(request, actionKey, { logPrefix: 'Metrics-Core' });
}
