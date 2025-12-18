import { NextRequest } from 'next/server';
import { type User } from '../auth';
export type AuthContext = {
    kind: 'user';
    user: User;
} | {
    kind: 'service';
};
export declare function getAuthContext(request: NextRequest): AuthContext | null;
//# sourceMappingURL=authz.d.ts.map