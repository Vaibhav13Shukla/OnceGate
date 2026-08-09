import type { Database } from './db.js';
import { addEvent } from './receipts.js';

export async function markStalePendingUnknown(db: Database): Promise<number> {
  const result = await db.query<{ id: string }>("UPDATE receipts SET status='UNKNOWN', updated_at=now() WHERE status='PENDING' AND execution_deadline < now() RETURNING id");
  for (const row of result.rows) await addEvent(db, row.id, 'MARKED_UNKNOWN', { reason: 'execution_deadline_elapsed' });
  return result.rowCount ?? 0;
}

export async function purgeExpiredReceipts(db: Database): Promise<number> {
  const result = await db.query('DELETE FROM receipts WHERE expires_at < now()');
  return result.rowCount ?? 0;
}
