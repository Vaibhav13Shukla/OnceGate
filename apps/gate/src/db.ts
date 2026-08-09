import pg from 'pg';

export function createPool(connectionString: string) {
  const needsSsl = connectionString.includes('supabase') ||
                   connectionString.includes('pooler') ||
                   connectionString.includes('sslmode') ||
                   connectionString.includes('.com') ||
                   process.env.VERCEL === '1';

  return new pg.Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined
  });
}

export type Database = ReturnType<typeof createPool>;
