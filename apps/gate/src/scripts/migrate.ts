import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool } from '../db.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const db = createPool(databaseUrl);
await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
const directory = resolve(import.meta.dirname, '../../migrations');
for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
  if ((await db.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
  await db.query('BEGIN');
  try { await db.query(await readFile(resolve(directory, name), 'utf8')); await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]); await db.query('COMMIT'); }
  catch (error) { await db.query('ROLLBACK'); throw error; }
}
await db.end();
