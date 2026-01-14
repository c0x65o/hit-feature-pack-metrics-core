import { checkActionPermission, requireActionPermission, } from '@hit/feature-pack-auth-core/server/lib/action-check';
export async function checkMetricsCoreAction(request, actionKey) {
    return checkActionPermission(request, actionKey, { logPrefix: 'Metrics-Core' });
}
export async function requireMetricsCoreAction(request, actionKey) {
    return requireActionPermission(request, actionKey, { logPrefix: 'Metrics-Core' });
}
