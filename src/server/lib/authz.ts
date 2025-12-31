import { NextRequest } from 'next/server';
import { extractUserFromRequest, type User } from '../auth';

export type AuthContext =
  | { kind: 'user'; user: User }
  | { kind: 'service' };

export function getAuthContext(request: NextRequest): AuthContext | null {
  const user = extractUserFromRequest(request);
  if (user) return { kind: 'user', user };

  const hdr = request.headers.get('x-hit-service-token') || request.headers.get('X-HIT-Service-Token');
  const expected = process.env.HIT_SERVICE_TOKEN;
  if (expected && hdr && hdr === expected) return { kind: 'service' };

  return null;
}

/**
 * Check if the current context has permission to read specific metrics.
 * Calls the auth module batch check endpoint.
 *
 * @param request - Original request (to forward headers)
 * @param metricKeys - List of metric keys to check
 * @returns Map of metricKey -> boolean (has permission)
 */
export async function checkMetricPermissions(
  request: NextRequest,
  metricKeys: string[]
): Promise<Record<string, boolean>> {
  if (metricKeys.length === 0) return {};

  const ctx = getAuthContext(request);
  if (!ctx) return Object.fromEntries(metricKeys.map((k) => [k, false]));

  // Service token bypasses individual checks (internal service-to-service communication)
  if (ctx.kind === "service") return Object.fromEntries(metricKeys.map((k) => [k, true]));

  // Call auth module for decision
  const authUrl = process.env.HIT_AUTH_URL || process.env.NEXT_PUBLIC_HIT_AUTH_URL;
  if (!authUrl) {
    console.warn("[metrics-core] HIT_AUTH_URL not configured; denying all metric access (fail closed).");
    return Object.fromEntries(metricKeys.map((k) => [k, false]));
  }

  const bearer =
    request.headers.get("authorization") ||
    `Bearer ${request.cookies.get("hit_token")?.value}`;

  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const frontendBaseUrl = host ? `${proto}://${host}` : "";

  try {
    const res = await fetch(`${authUrl.replace(/\/$/, "")}/permissions/metrics/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearer,
        "X-HIT-Service-Token": process.env.HIT_SERVICE_TOKEN || "",
        "X-Frontend-Base-URL": frontendBaseUrl,
      },
      body: JSON.stringify(metricKeys),
    });

    if (!res.ok) {
      console.error(`[metrics-core] Auth batch check failed: ${res.status} ${res.statusText}`);
      return Object.fromEntries(metricKeys.map((k) => [k, false]));
    }

    const decisions = (await res.json()) as Record<string, boolean>;
    return decisions;
  } catch (e) {
    console.error("[metrics-core] Error calling auth for metric check:", e);
    return Object.fromEntries(metricKeys.map((k) => [k, false]));
  }
}



