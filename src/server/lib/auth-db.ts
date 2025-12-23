import { Pool } from 'pg';

// Normalize DATABASE_URL: strip SQLAlchemy driver suffix (e.g. postgresql+psycopg://)
// node-postgres expects plain postgresql://
function normalizeDatabaseUrl(url: string): string {
  return url
    .replace(/^postgresql\+\w+:\/\//, 'postgresql://')
    .replace(/^postgres:\/\//, 'postgresql://');
}

let pool: Pool | undefined;

function getAuthPool(): Pool {
  if (!pool) {
    const raw = process.env.HIT_AUTH_DATABASE_URL;
    if (!raw) {
      throw new Error('HIT_AUTH_DATABASE_URL not set (required for user segments)');
    }
    pool = new Pool({ connectionString: normalizeDatabaseUrl(raw) });
  }
  return pool;
}

export async function authQuery<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await getAuthPool().query(text, params);
  return (res.rows || []) as T[];
}


