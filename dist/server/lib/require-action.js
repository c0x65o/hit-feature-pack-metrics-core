import { NextResponse } from 'next/server';
function getTokenFromRequest(request) {
    const cookieToken = request.cookies.get('hit_token')?.value || null;
    if (cookieToken)
        return cookieToken;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer '))
        return authHeader.slice(7);
    return null;
}
function baseUrlFromRequest(request) {
    const proto = request.headers.get('x-forwarded-proto') ||
        (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const host = request.headers.get('x-forwarded-host') ||
        request.headers.get('host') ||
        '';
    return `${proto}://${host}`;
}
export async function checkMetricsCoreAction(request, actionKey) {
    const token = getTokenFromRequest(request);
    if (!token) {
        console.log(`[Metrics-Core Action Check] ${actionKey}: No token found`);
        return { ok: false, source: 'unauthenticated' };
    }
    const baseUrl = baseUrlFromRequest(request);
    const url = `${baseUrl}/api/proxy/auth/permissions/actions/check/${encodeURIComponent(actionKey)}`;
    console.log(`[Metrics-Core Action Check] ${actionKey}: Checking via ${url}`);
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        // Ensure cookies flow too (proxy can also read hit_token cookie)
        credentials: 'include',
    }).catch((e) => {
        console.log(`[Metrics-Core Action Check] ${actionKey}: Fetch error:`, e);
        return null;
    });
    if (!res) {
        console.log(`[Metrics-Core Action Check] ${actionKey}: Auth unreachable (no response)`);
        return { ok: false, source: 'auth_unreachable' };
    }
    if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.log(`[Metrics-Core Action Check] ${actionKey}: Auth returned status ${res.status}:`, errorText);
        return { ok: false, source: `auth_status_${res.status}` };
    }
    const json = (await res.json().catch(() => null));
    const ok = Boolean(json?.has_permission ?? json?.hasPermission ?? false);
    console.log(`[Metrics-Core Action Check] ${actionKey}: Result`, { ok, source: json?.source, response: json });
    return { ok, source: String(json?.source || '') || undefined };
}
export async function requireMetricsCoreAction(request, actionKey) {
    const result = await checkMetricsCoreAction(request, actionKey);
    if (result.ok)
        return null;
    // Treat missing/invalid auth as 401; otherwise 403.
    const status = result.source === 'unauthenticated' ? 401 : 403;
    const error = status === 401 ? 'Unauthorized' : 'Not authorized';
    return NextResponse.json({
        error,
        action: actionKey,
    }, { status });
}
