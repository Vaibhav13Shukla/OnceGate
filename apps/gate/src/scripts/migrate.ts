import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL || 'postgres://localhost:5432/oncegate_test';
try {
  const db = createPool(databaseUrl);
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = resolve(__dirname, '../../migrations');
  for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
    if ((await db.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
    await db.query('BEGIN');
    try {
      await db.query(await readFile(resolve(directory, name), 'utf8'));
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
  await db.end();
  console.log('Database migrations executed successfully.');
} catch (err) {
  console.error('Migration warning (will retry on boot):', err);
}
