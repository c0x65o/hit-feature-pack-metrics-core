import { extractUserFromRequest } from '../auth';
function getExternalOriginFromRequest(request) {
    // Prefer an explicitly provided frontend base URL (some proxies strip/override host headers).
    const explicit = request.headers.get('x-frontend-base-url') || request.headers.get('X-Frontend-Base-URL') || '';
    if (explicit && explicit.trim())
        return explicit.trim().replace(/\/$/, '');
    const hostRaw = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const protoRaw = request.headers.get('x-forwarded-proto') || 'http';
    // Handle comma-separated values from chained proxies.
    const host = String(hostRaw).split(',')[0]?.trim();
    const proto = String(protoRaw).split(',')[0]?.trim() || 'http';
    if (host)
        return `${proto}://${host}`;
    return new URL(request.url).origin;
}
function getAuthBaseUrlFromRequest(request) {
    // Auth is app-local (Next.js API dispatcher under /api/auth).
    const origin = getExternalOriginFromRequest(request);
    return `${origin}/api/auth`.replace(/\/$/, '');
}
function isServiceTokenAuthorized(request) {
    const expected = process.env.HIT_SERVICE_TOKEN;
    if (!expected)
        return false;
    // Preferred (explicit) service header.
    const svcHeader = request.headers.get('x-hit-service-token') || request.headers.get('X-HIT-Service-Token');
    if (svcHeader && String(svcHeader) === String(expected))
        return true;
    // QoL / compatibility: allow the service token to be sent as a bearer token too.
    // This lets background jobs use a single "bearer token" mechanism consistently.
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    const auth = String(authHeader).trim();
    if (!auth.toLowerCase().startsWith('bearer '))
        return false;
    const token = auth.slice('bearer '.length).trim();
    if (!token)
        return false;
    return token === String(expected);
}
export function getAuthContext(request) {
    // Service tokens (internal service-to-service / CLI communication)
    if (isServiceTokenAuthorized(request))
        return { kind: 'service' };
    const user = extractUserFromRequest(request);
    if (user)
        return { kind: 'user', user };
    return null;
}
/**
 * Check if the current user is an admin (has 'admin' in roles).
 * Used for admin-only operations like viewing the full metrics catalog.
 */
export function isAdminUser(request) {
    const ctx = getAuthContext(request);
    if (!ctx)
        return false;
    if (ctx.kind !== 'user')
        return false;
    const roles = ctx.user.roles || [];
    return roles.some((r) => r.toLowerCase() === 'admin');
}
/**
 * Check if the current context has permission to read specific metrics.
 * Calls the auth module batch check endpoint.
 *
 * @param request - Original request (to forward headers)
 * @param metricKeys - List of metric keys to check
 * @returns Map of metricKey -> boolean (has permission)
 */
export async function checkMetricPermissions(request, metricKeys) {
    if (metricKeys.length === 0)
        return {};
    const ctx = getAuthContext(request);
    if (!ctx)
        return Object.fromEntries(metricKeys.map((k) => [k, false]));
    // Admin bypasses all checks. This is a UI/ops requirement: admins should never see "missing metrics".
    // NOTE: extractUserFromRequest() is a lightweight JWT payload decode (no signature verify) but
    // sufficient for gating UI visibility and avoiding lockout if auth module config/token wiring breaks.
    if (isAdminUser(request))
        return Object.fromEntries(metricKeys.map((k) => [k, true]));
    const authBaseUrl = getAuthBaseUrlFromRequest(request);
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const cookieToken = request.cookies.get("hit_token")?.value;
    const bearer = authHeader ? authHeader : (cookieToken ? `Bearer ${cookieToken}` : "");
    if (!bearer || bearer === "Bearer undefined") {
        console.warn("[metrics-core] Missing user bearer token for metric permission check; denying (fail closed).");
        return Object.fromEntries(metricKeys.map((k) => [k, false]));
    }
    const frontendBaseUrl = getExternalOriginFromRequest(request);
    try {
        const res = await fetch(`${authBaseUrl}/permissions/metrics/check`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: bearer,
                "X-Frontend-Base-URL": frontendBaseUrl,
            },
            body: JSON.stringify(metricKeys),
        });
        if (!res.ok) {
            console.error(`[metrics-core] Auth batch check failed: ${res.status} ${res.statusText}`);
            return Object.fromEntries(metricKeys.map((k) => [k, false]));
        }
        const decisions = (await res.json());
        return decisions;
    }
    catch (e) {
        console.error("[metrics-core] Error calling auth for metric check:", e);
        return Object.fromEntries(metricKeys.map((k) => [k, false]));
    }
}
