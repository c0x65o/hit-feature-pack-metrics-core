import { createRequire } from 'node:module';
// Normalize DATABASE_URL: strip SQLAlchemy driver suffix (e.g. postgresql+psycopg://)
// node-postgres expects plain postgresql://
function normalizeDatabaseUrl(url) {
    return url
        .replace(/^postgresql\+\w+:\/\//, 'postgresql://')
        .replace(/^postgres:\/\//, 'postgresql://');
}
let pool;
function getAuthPool() {
    if (!pool) {
        const raw = process.env.HIT_AUTH_DATABASE_URL;
        if (!raw) {
            throw new Error('HIT_AUTH_DATABASE_URL not set (required for user segments)');
        }
        // IMPORTANT:
        // This code runs inside Next.js server runtime. Importing `pg` as ESM can cause
        // webpack to pull in `pg/esm` which then hits an ESM/CJS interop edge case with
        // `pg-pool`, crashing at runtime with:
        //   "Class extends value #<Object> is not a constructor or null"
        //
        // Using `createRequire()` forces Node/webpack to resolve `pg` via the `"require"`
        // export condition, which avoids the ESM wrapper and fixes the crash.
        const require = createRequire(import.meta.url);
        const Pg = require('pg');
        const PoolCtor = Pg.Pool;
        pool = new PoolCtor({ connectionString: normalizeDatabaseUrl(raw) });
    }
    return pool;
}
export async function authQuery(text, params = []) {
    const res = await getAuthPool().query(text, params);
    return (res.rows || []);
}
