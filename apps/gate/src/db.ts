import pg from 'pg';

export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString });
}

export type Database = ReturnType<typeof createPool>;
