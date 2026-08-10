import type { FastifyInstance } from 'fastify';
import type { Database } from './db.js';
import { problem } from './problem.js';
import { type Receipt } from './receipts.js';
import { assertTransition, type ReceiptStatus } from './state.js';

function adminOnly(app: FastifyInstance, token: string) {
  app.addHook('onRequest', async (request, reply) => {
    if (!token || request.headers.authorization !== `Bearer ${token}`) return problem(reply, 401, 'unauthorized', 'Unauthorized', 'A valid bearer token is required.');
  });
}

export function registerControlRoutes(app: FastifyInstance, db: Database, adminToken: string) {
  if (!adminToken) app.log.warn('ADMIN_TOKEN is empty — all control API requests will be rejected');
  app.register((control, _options, done) => {
  adminOnly(control, adminToken);
  control.get('/v1/receipts', async (request) => {
    const query = request.query as { status?: string; limit?: string; cursor?: string };
    const validStatuses = ['PENDING', 'COMMITTED', 'FAILED', 'UNKNOWN'];
    if (query.status && !validStatuses.includes(query.status)) return { items: [], next_cursor: null };
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);
    const values: unknown[] = [];
    const where: string[] = [];
    if (query.status) { values.push(query.status); where.push(`status = $${values.length}`); }
    if (query.cursor) { values.push(query.cursor); where.push(`created_at < $${values.length}`); }
    values.push(limit);
    const rows = await db.query<Receipt>(`SELECT * FROM receipts ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${values.length}`, values);
    return { items: rows.rows, next_cursor: rows.rows.at(-1)?.created_at ?? null };
  });
  control.get('/v1/receipts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const receipt = await db.query<Receipt>('SELECT * FROM receipts WHERE id = $1', [id]);
    if (!receipt.rowCount) return problem(reply, 404, 'receipt-not-found', 'Receipt not found', 'No receipt exists with this ID.');
    const events = await db.query('SELECT * FROM events WHERE receipt_id = $1 ORDER BY created_at ASC', [id]);
    return { ...receipt.rows[0], events: events.rows };
  });
  control.get('/v1/receipts/:id/explain', async (request, reply) => {
    const { id } = request.params as { id: string };
    const receipt = await db.query<Receipt>('SELECT * FROM receipts WHERE id = $1', [id]);
    if (!receipt.rowCount) return problem(reply, 404, 'receipt-not-found', 'Receipt not found', 'No receipt exists with this ID.');
    const events = await db.query<{ kind: string; created_at: string; detail: any }>('SELECT * FROM events WHERE receipt_id = $1 ORDER BY created_at ASC', [id]);

    const r = receipt.rows[0];
    const evList = events.rows.map(e => e.kind).join(' → ');

    let summary = '';
    let remediation = '';
    if (r.status === 'UNKNOWN') {
      summary = `Receipt state is UNKNOWN. OnceGate forwarded the request to the upstream target (${r.path}), but the HTTP connection timed out or closed before response headers were delivered. The upstream side-effect may or may not have committed in PostgreSQL.`;
      remediation = 'Verify the upstream database status manually, then resolve this receipt to COMMITTED or FAILED via the Ops Console with an audit note.';
    } else if (r.status === 'COMMITTED') {
      summary = `Receipt state is COMMITTED. Upstream returned HTTP ${r.upstream_status ?? 200}. The result is durably stored in PostgreSQL and will be replayed directly for identical idempotency keys.`;
      remediation = 'No action required. Subsequent client retrying with this key will safely receive the replayed response without duplicate execution.';
    } else if (r.status === 'PENDING') {
      summary = 'Receipt state is PENDING. An upstream request is currently in flight or awaiting settlement.';
      remediation = 'Wait for request completion or pending sweeper evaluation.';
    } else {
      summary = `Receipt state is FAILED (${r.upstream_status ?? '5xx'}). The upstream returned a deterministic failure status code.`;
      remediation = 'Client may retry with a new or existing key depending on upstream error semantics.';
    }

    return {
      receipt_id: r.id,
      idempotency_key: r.idempotency_key,
      status: r.status,
      audit_events: evList,
      summary,
      remediation,
      evidence: {
        attempts: r.attempt_count,
        created_at: r.created_at,
        updated_at: r.updated_at,
        fingerprint: r.fingerprint,
        upstream_status: r.upstream_status
      },
      deterministic_truth: true
    };
  });
  control.post('/v1/receipts/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    let body: { status?: ReceiptStatus; note?: string } | undefined;
    try { body = Buffer.isBuffer(request.body) ? JSON.parse(request.body.toString('utf8')) : request.body as { status?: ReceiptStatus; note?: string }; }
    catch { return problem(reply, 400, 'invalid-resolution', 'Invalid resolution', 'Resolution body must be valid JSON.'); }
    if (!body || !['COMMITTED', 'FAILED'].includes(body.status ?? '') || !body.note?.trim()) return problem(reply, 400, 'invalid-resolution', 'Invalid resolution', 'status must be COMMITTED or FAILED and note must be non-empty.');

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const receipt = await client.query<Receipt>('SELECT * FROM receipts WHERE id=$1 FOR UPDATE', [id]);
      if (!receipt.rowCount) { await client.query('ROLLBACK'); return problem(reply, 404, 'receipt-not-found', 'Receipt not found', 'No receipt exists with this ID.'); }
      try { assertTransition(receipt.rows[0].status, body.status!); } catch { await client.query('ROLLBACK'); return problem(reply, 409, 'invalid-resolution-state', 'Receipt cannot be resolved', 'Only UNKNOWN receipts can be resolved.'); }
      const updated = await client.query<Receipt>('UPDATE receipts SET status=$2, resolution_note=$3, updated_at=now() WHERE id=$1 RETURNING *', [id, body.status, body.note.trim()]);
      await client.query('INSERT INTO events (receipt_id, kind, detail) VALUES ($1, $2, $3)', [id, 'RESOLVED', { status: body.status, note: body.note.trim() }]);
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
  control.get('/v1/stats', async () => {
    const stats = await db.query<{ total: string; replayed: string; conflicts_in_flight: string; mismatches: string; unknown_open: string }>(
      `SELECT (SELECT count(*) FROM receipts) total,
        (SELECT count(*) FROM events WHERE kind='REPLAYED') replayed,
        (SELECT count(*) FROM events WHERE kind='CONFLICT_IN_FLIGHT') conflicts_in_flight,
        (SELECT count(*) FROM events WHERE kind='FINGERPRINT_MISMATCH') mismatches,
        (SELECT count(*) FROM receipts WHERE status='UNKNOWN') unknown_open`
    );
    const row = stats.rows[0]; const replayed = Number(row.replayed); const conflicts = Number(row.conflicts_in_flight);
    return { total: Number(row.total), replayed, conflicts_in_flight: conflicts, mismatches: Number(row.mismatches), unknown_open: Number(row.unknown_open), duplicates_prevented: replayed + conflicts };
  });
  done();
  });
}
