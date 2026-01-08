import { NextRequest } from 'next/server';
export interface User {
    sub: string;
    email: string;
    roles?: string[];
}
export declare function extractUserFromRequest(request: NextRequest): User | null;
//# sourceMappingURL=auth.d.ts.map