import { NextRequest } from 'next/server';
import { type User } from '../auth';
export type AuthContext = {
    kind: 'user';
    user: User;
} | {
    kind: 'service';
};
export declare function getAuthContext(request: NextRequest): AuthContext | null;
/**
 * Check if the current context has permission to read specific metrics.
 * Calls the auth module batch check endpoint.
 *
 * @param request - Original request (to forward headers)
 * @param metricKeys - List of metric keys to check
 * @returns Map of metricKey -> boolean (has permission)
 */
export declare function checkMetricPermissions(request: NextRequest, metricKeys: string[]): Promise<Record<string, boolean>>;
//# sourceMappingURL=authz.d.ts.map