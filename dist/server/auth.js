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
    // Check x-user-id header (set by proxy in production)
    const xUserId = request.headers.get('x-user-id');
    if (xUserId) {
        return { sub: xUserId, email: '' };
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
        return { sub: payload.sub, email: payload.email || '', roles: payload.roles || [] };
    }
    catch {
        return null;
    }
}
