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


