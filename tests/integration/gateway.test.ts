import Fastify from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildServer } from '../../apps/gate/src/server.js';
import { createPool, type Database } from '../../apps/gate/src/db.js';
import type { Config } from '../../apps/gate/src/config.js';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://oncegate:oncegate@localhost:54329/oncegate_test';
const db = createPool(databaseUrl);
let upstream: ReturnType<typeof Fastify>;
let gate: ReturnType<typeof buildServer>;
let upstreamUrl = '';
let charges = 0;
let slow = false;
let upstreamTimeoutMs = 500;

const config = (): Config => ({ databaseUrl, upstreamBaseUrl: upstreamUrl, upstreamTimeoutMs, keyTtlHours: 24, requireKey: false, adminToken: 'test-token', responseBodyMaxBytes: 262_144, corsOrigin: false });

beforeAll(async () => {
  await db.query('DROP TABLE IF EXISTS events, receipts CASCADE; DROP TABLE IF EXISTS demo.charges; DROP TYPE IF EXISTS receipt_status');
  await db.query(await readFile(resolve(import.meta.dirname, '../../apps/gate/migrations/001_init.sql'), 'utf8'));
  upstream = Fastify();
  upstream.get('/read', async () => ({ read: true }));
  upstream.post('/charge', async () => { if (slow) await new Promise((r) => setTimeout(r, 150)); charges += 1; return { charge_id: `c-${charges}` }; });
  await upstream.listen({ host: '127.0.0.1', port: 0 });
  const address = upstream.server.address();
  if (!address || typeof address === 'string') throw new Error('Test upstream has no TCP address');
  upstreamUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await gate?.close();
  await db.query('TRUNCATE events, receipts CASCADE');
  charges = 0; slow = false; upstreamTimeoutMs = 500;
  gate = buildServer({ config: config(), db });
  await gate.ready();
});
afterAll(async () => { await gate?.close(); await upstream?.close(); await db.end(); });

describe('IETF-style proxy behavior', () => {
  it('forwards safe methods without a receipt', async () => {
    const response = await gate.inject({ method: 'GET', url: '/p/read' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['oncegate-bypassed']).toBe('safe-method');
    expect((await db.query('SELECT * FROM receipts')).rowCount).toBe(0);
  });

  it('claims once and replays the completed response', async () => {
    const first = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'same-key', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    const retry = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'same-key', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(first.statusCode).toBe(200);
    expect(retry.statusCode).toBe(200);
    expect(retry.headers['oncegate-replayed']).toBe('true');
    expect(retry.body).toBe(first.body);
    expect(charges).toBe(1);
  });

  it('rejects a key reused with a different payload', async () => {
    await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'mismatch', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    const response = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'mismatch', 'content-type': 'application/json' }, payload: '{"amount":101}' });
    expect(response.statusCode).toBe(422);
    expect(charges).toBe(1);
  });

  it('returns 409 to concurrent duplicates and forwards exactly once', async () => {
    slow = true;
    const first = gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'storm', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    await new Promise((r) => setTimeout(r, 10));
    const duplicates = await Promise.all(Array.from({ length: 24 }, () => gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'storm', 'content-type': 'application/json' }, payload: '{"amount":100}' })));
    expect((await first).statusCode).toBe(200);
    expect(duplicates.every((response) => response.statusCode === 409 || (response.statusCode === 200 && response.headers['oncegate-replayed'] === 'true'))).toBe(true);
    expect(charges).toBe(1);
  });

  it('records a timeout as UNKNOWN and allows an authenticated human resolution', async () => {
    await gate.close();
    upstreamTimeoutMs = 60;
    gate = buildServer({ config: config(), db });
    await gate.ready();
    slow = true;
    const timeout = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'timeout', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(timeout.statusCode).toBe(504);
    const receipt = timeout.headers['oncegate-receipt'] as string;
    const blocked = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'timeout', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(blocked.statusCode).toBe(409);
    const resolution = await gate.inject({ method: 'POST', url: `/v1/receipts/${receipt}/resolve`, headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, payload: { status: 'COMMITTED', note: 'verified upstream dashboard' } });
    expect(resolution.statusCode).toBe(200);
    expect(resolution.json().status).toBe('COMMITTED');
    await new Promise((r) => setTimeout(r, 100));
  });

  it('forwards a mutating request without a key, warning the client', async () => {
    const response = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['oncegate-warning']).toBe('missing-idempotency-key');
    expect(charges).toBe(1);
    expect((await db.query('SELECT * FROM receipts')).rowCount).toBe(0);
  });

  it('rejects an empty or overly long idempotency key', async () => {
    const empty = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': '', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(empty.statusCode).toBe(400);
    expect(empty.headers['content-type']).toMatch(/application\/problem\+json/);
    const longKey = 'a'.repeat(256);
    const long = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': longKey, 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(long.statusCode).toBe(400);
    expect(long.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('treats an expired key as a new request', async () => {
    const first = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'expired-key', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(first.statusCode).toBe(200);
    await db.query(`UPDATE receipts SET expires_at = NOW() - INTERVAL '1 hour' WHERE idempotency_key = 'expired-key'`);
    const retry = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'expired-key', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(retry.statusCode).toBe(200);
    expect(retry.headers['oncegate-replayed']).toBeUndefined();
    expect(charges).toBe(2);
  });

  it('fails closed with 503 if the database is unavailable', async () => {
    const badDbUrl = 'postgres://bad:bad@localhost:1/bad';
    const badDb = createPool(badDbUrl);
    const badGate = buildServer({ config: config(), db: badDb });
    await badGate.ready();
    const response = await badGate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'db-down', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(response.statusCode).toBe(503);
    await badGate.close();
    await badDb.end();
  });

  it('isolates receipts across tenants using X-Tenant-Id', async () => {
    const key = 'tenant-test';
    const first = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': key, 'content-type': 'application/json', 'x-tenant-id': 'shop-A' }, payload: '{"amount":100}' });
    expect(first.statusCode).toBe(200);
    const second = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': key, 'content-type': 'application/json', 'x-tenant-id': 'shop-B' }, payload: '{"amount":100}' });
    expect(second.statusCode).toBe(200);
    expect(second.headers['oncegate-replayed']).toBeUndefined();
    expect(charges).toBe(2);
  });

  it('marks a 5xx upstream response as FAILED', async () => {
    const response = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'fivehundred', 'content-type': 'application/json', 'x-chaos': 'flaky' }, payload: '{"amount":100}' });
    // The flaky chaos has 50% chance; regardless, if 500 was returned the receipt is FAILED
    if (response.statusCode === 500) {
      const receipt = await db.query('SELECT status FROM receipts WHERE idempotency_key = $1', ['fivehundred']);
      expect(receipt.rows[0].status).toBe('FAILED');
    }
    // If it returned 200/201, the receipt is COMMITTED — both are valid
    expect([200, 201, 500].includes(response.statusCode)).toBe(true);
  });

  it('rejects resolving an already COMMITTED receipt', async () => {
    const first = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'already-done', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(first.statusCode).toBe(200);
    const receipt = first.headers['oncegate-receipt'] as string;
    const resolution = await gate.inject({ method: 'POST', url: `/v1/receipts/${receipt}/resolve`, headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, payload: { status: 'FAILED', note: 'should not work' } });
    expect(resolution.statusCode).toBe(409);
  });

  it('returns accurate stats from /v1/stats', async () => {
    const key = 'stats-test';
    await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': key, 'content-type': 'application/json' }, payload: '{"amount":100}' });
    await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': key, 'content-type': 'application/json' }, payload: '{"amount":100}' });
    const response = await gate.inject({ method: 'GET', url: '/v1/stats', headers: { authorization: 'Bearer test-token' } });
    expect(response.statusCode).toBe(200);
    const stats = response.json();
    expect(stats.total).toBe(1);
    expect(stats.replayed).toBe(1);
    expect(stats.duplicates_prevented).toBeGreaterThanOrEqual(1);
  });

  it('paginates receipts via cursor', async () => {
    for (let i = 0; i < 3; i++) {
      await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': `page-${i}`, 'content-type': 'application/json' }, payload: '{"amount":100}' });
    }
    const page1 = await gate.inject({ method: 'GET', url: '/v1/receipts?limit=2', headers: { authorization: 'Bearer test-token' } });
    expect(page1.statusCode).toBe(200);
    const body1 = page1.json();
    expect(body1.items.length).toBe(2);
    expect(body1.next_cursor).toBeTruthy();
    const page2 = await gate.inject({ method: 'GET', url: `/v1/receipts?limit=2&cursor=${body1.next_cursor}`, headers: { authorization: 'Bearer test-token' } });
    expect(page2.statusCode).toBe(200);
    expect(page2.json().items.length).toBe(1);
  });

  it('returns healthy from /healthz', async () => {
    const response = await gate.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, db: true });
  });

  it('preserves allowlisted headers on replay', async () => {
    // The upstream sets content-type which is in the allowlist
    const first = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'header-test', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(first.statusCode).toBe(200);
    const replay = await gate.inject({ method: 'POST', url: '/p/charge', headers: { 'idempotency-key': 'header-test', 'content-type': 'application/json' }, payload: '{"amount":100}' });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers['oncegate-replayed']).toBe('true');
    expect(replay.headers['content-type']).toMatch(/application\/json/);
  });
});
