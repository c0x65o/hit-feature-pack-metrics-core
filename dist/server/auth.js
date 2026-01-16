export function extractUserFromRequest(request) {
    // Check cookie first
    let token = request.cookies.get('hit_token')?.value;
    // Fall back to Authorization header
    if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
    }
    if (!token)
        return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now())
            return null;
        const rolesRaw = Array.isArray(payload.roles) ? payload.roles : [];
        const roleSingle = typeof payload.role === 'string' ? payload.role : '';
        const roles = rolesRaw
            .map((r) => String(r || '').trim())
            .filter(Boolean);
        if (roleSingle && !roles.includes(roleSingle))
            roles.unshift(roleSingle);
        return { sub: payload.sub, email: payload.email || payload.sub || '', roles };
    }
    catch {
        return null;
    }
}
