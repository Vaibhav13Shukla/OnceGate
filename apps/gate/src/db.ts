import pg from 'pg';

export function createPool(connectionString: string) {
  const needsSsl = connectionString.includes('supabase') ||
                   connectionString.includes('pooler') ||
                   connectionString.includes('sslmode') ||
                   connectionString.includes('.com') ||
                   process.env.VERCEL === '1';

  const pool = new pg.Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error on idle client:', err);
  });

  return pool;
}

export type Database = ReturnType<typeof createPool>;
