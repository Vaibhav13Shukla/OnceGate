import type { Database } from './db.js';
import { assertTransition, type ReceiptStatus } from './state.js';

export interface Receipt {
  id: string; tenant: string; idempotency_key: string; fingerprint: string; method: string; path: string;
  status: ReceiptStatus; upstream_status: number | null; response_headers: Record<string, string> | null;
  response_body: Buffer | null; response_truncated: boolean; attempt_count: number;
  created_at: Date; updated_at: Date; execution_deadline: Date; expires_at: Date; resolution_note: string | null;
}

export async function addEvent(db: Database, receiptId: string, kind: string, detail: Record<string, unknown> = {}) {
  await db.query('INSERT INTO events (receipt_id, kind, detail) VALUES ($1, $2, $3)', [receiptId, kind, detail]);
}

export async function claimOrLoad(db: Database, input: { tenant: string; key: string; fingerprint: string; method: string; path: string; deadline: Date; expiresAt: Date }) {
  await db.query('DELETE FROM receipts WHERE tenant = $1 AND idempotency_key = $2 AND expires_at <= now()', [input.tenant, input.key]);
  const inserted = await db.query<Receipt>(
    `INSERT INTO receipts (tenant, idempotency_key, fingerprint, method, path, execution_deadline, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant,idempotency_key) DO NOTHING RETURNING *`,
    [input.tenant, input.key, input.fingerprint, input.method, input.path, input.deadline, input.expiresAt]
  );
  if (inserted.rowCount) { await addEvent(db, inserted.rows[0].id, 'CLAIMED'); return { claimed: true as const, receipt: inserted.rows[0] }; }
  const existing = await db.query<Receipt>('SELECT * FROM receipts WHERE tenant = $1 AND idempotency_key = $2', [input.tenant, input.key]);
  if (!existing.rowCount) return claimOrLoad(db, input);
  await db.query('UPDATE receipts SET attempt_count = attempt_count + 1, updated_at = now() WHERE id = $1', [existing.rows[0].id]);
  existing.rows[0].attempt_count += 1;
  return { claimed: false as const, receipt: existing.rows[0] };
}

export async function settle(db: Database, receipt: Receipt, status: Extract<ReceiptStatus, 'COMMITTED' | 'FAILED' | 'UNKNOWN'>, result: { upstreamStatus?: number; headers?: Record<string, string>; body?: Buffer; truncated?: boolean } = {}) {
  assertTransition(receipt.status, status);
  const updated = await db.query<Receipt>(
    `UPDATE receipts SET status=$2, upstream_status=$3, response_headers=$4, response_body=$5, response_truncated=$6, updated_at=now()
     WHERE id=$1 AND status=$7 RETURNING *`,
    [receipt.id, status, result.upstreamStatus ?? null, result.headers ?? null, result.body ?? null, result.truncated ?? false, receipt.status]
  );
  if (!updated.rowCount) throw new Error(`Receipt ${receipt.id} was changed concurrently`);
  await addEvent(db, receipt.id, status === 'UNKNOWN' ? 'MARKED_UNKNOWN' : status, { upstream_status: result.upstreamStatus });
  return updated.rows[0];
}
