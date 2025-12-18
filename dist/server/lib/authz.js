import { extractUserFromRequest } from '../auth';
export function getAuthContext(request) {
    const user = extractUserFromRequest(request);
    if (user)
        return { kind: 'user', user };
    const hdr = request.headers.get('x-hit-service-token') || request.headers.get('X-HIT-Service-Token');
    const expected = process.env.HIT_SERVICE_TOKEN;
    if (expected && hdr && hdr === expected)
        return { kind: 'service' };
    return null;
}
