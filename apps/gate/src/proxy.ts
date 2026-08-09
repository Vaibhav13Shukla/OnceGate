import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Config } from './config.js';
import type { Database } from './db.js';
import { fingerprint } from './fingerprint.js';
import { problem } from './problem.js';
import { addEvent, claimOrLoad, type Receipt, settle } from './receipts.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const responseHeaderAllowlist = new Set([
  'content-type',
  'content-language',
  'location',
  'cache-control',
  'etag',
  'x-request-id',
  'stripe-version',
  'x-correlation-id',
  'last-modified'
]);

function pathFromRequest(request: FastifyRequest): string {
  return request.url.replace(/^\/p(?=\/|$)/, '').split('?')[0] || '/';
}

function requestHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    const lower = name.toLowerCase();
    if (value !== undefined && !['host', 'content-length', 'authorization', 'cookie', 'set-cookie'].includes(lower)) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  return headers;
}

function storedHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    if (responseHeaderAllowlist.has(name.toLowerCase())) headers[name] = value;
  });
  return headers;
}

function upstreamBody(body: Buffer): Blob | undefined {
  return body.length ? new Blob([new Uint8Array(body)]) : undefined;
}

function sendStored(reply: FastifyReply, receipt: Receipt) {
  for (const [name, value] of Object.entries(receipt.response_headers ?? {})) reply.header(name, value);
  reply.header('OnceGate-Replayed', 'true').header('OnceGate-Receipt', receipt.id);
  return reply.code(receipt.upstream_status ?? 502).send(receipt.response_body ?? Buffer.alloc(0));
}

function sendInFlight(reply: FastifyReply, receipt: Receipt) {
  reply.header('Retry-After', '2').header('OnceGate-Receipt', receipt.id);
  return problem(reply, 409, 'in-flight', 'Request is in flight', 'A request with this idempotency key is still being processed. Retry after two seconds.');
}

function sendUnknown(reply: FastifyReply, receipt: Receipt) {
  reply.header('OnceGate-Receipt', receipt.id);
  return problem(reply, 409, 'outcome-unknown', 'Request outcome is unknown', 'OnceGate cannot safely replay or re-execute this request.', { resolve: `/v1/receipts/${receipt.id}` });
}

export function proxyHandler(db: Database, config: Config) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const path = pathFromRequest(request);
    const url = `${config.upstreamBaseUrl}${path}${request.url.includes('?') ? `?${request.url.split('?')[1]}` : ''}`;
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    const tenantHeader = request.headers['x-tenant-id'];
    const tenant = typeof tenantHeader === 'string' && tenantHeader.trim() && tenantHeader.length <= 128 ? tenantHeader.trim() : 'default';

    if (safeMethods.has(request.method)) {
      try {
        const upstream = await fetch(url, { method: request.method, headers: requestHeaders(request), signal: AbortSignal.timeout(config.upstreamTimeoutMs) });
        const responseBody = Buffer.from(await upstream.arrayBuffer());
        upstream.headers.forEach((value, name) => reply.header(name, value));
        return reply.header('OnceGate-Bypassed', 'safe-method').code(upstream.status).send(responseBody);
      } catch (error) {
        request.log.error({ err: error, operation: 'safe_forward' }, 'Safe-method upstream request failed');
        return problem(reply, 502, 'upstream-unavailable', 'Upstream unavailable', 'The upstream request could not be completed.');
      }
    }

    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || !key.trim() || key.length > 255) {
      if (key === undefined && !config.requireKey) {
        try {
          const upstream = await fetch(url, { method: request.method, headers: requestHeaders(request), body: upstreamBody(body), signal: AbortSignal.timeout(config.upstreamTimeoutMs) });
          const responseBody = Buffer.from(await upstream.arrayBuffer());
          upstream.headers.forEach((value, name) => reply.header(name, value));
          return reply.header('OnceGate-Warning', 'missing-idempotency-key').code(upstream.status).send(responseBody);
        } catch (error) {
          request.log.error({ err: error, operation: 'passthrough_forward' }, 'Passthrough upstream request failed');
          return problem(reply, 502, 'upstream-unavailable', 'Upstream unavailable', 'The upstream request could not be completed.');
        }
      }
      return problem(reply, 400, 'invalid-idempotency-key', 'Invalid Idempotency-Key', key === undefined ? 'An Idempotency-Key header is required.' : 'Idempotency-Key must be non-empty and at most 255 characters.');
    }

    const now = Date.now();
    const requestFingerprint = fingerprint(request.method, path, body);
    let result;
    try {
      result = await claimOrLoad(db, { tenant, key, fingerprint: requestFingerprint, method: request.method, path, deadline: new Date(now + config.upstreamTimeoutMs + 5_000), expiresAt: new Date(now + config.keyTtlHours * 3_600_000) });
    } catch (error) {
      request.log.error({ err: error, operation: 'claim', key }, 'Receipt claim failed; request was not forwarded');
      return problem(reply, 503, 'receipt-store-unavailable', 'Receipt store unavailable', 'OnceGate will not forward a request without a durable receipt claim.');
    }

    const receipt = result.receipt;
    reply.header('OnceGate-Receipt', receipt.id);
    if (!result.claimed) {
      if (receipt.fingerprint !== requestFingerprint) { await addEvent(db, receipt.id, 'FINGERPRINT_MISMATCH'); return problem(reply, 422, 'fingerprint-mismatch', 'Idempotency key payload mismatch', 'This Idempotency-Key was already used with a different method, path, or request body.'); }
      if (receipt.status === 'PENDING') { await addEvent(db, receipt.id, 'CONFLICT_IN_FLIGHT'); return sendInFlight(reply, receipt); }
      if (receipt.status === 'UNKNOWN') return sendUnknown(reply, receipt);
      await addEvent(db, receipt.id, 'REPLAYED');
      return sendStored(reply, receipt);
    }

    try {
      await addEvent(db, receipt.id, 'FORWARDED');
      const upstream = await fetch(url, { method: request.method, headers: requestHeaders(request), body: upstreamBody(body), signal: AbortSignal.timeout(config.upstreamTimeoutMs) });
      const fullBody = Buffer.from(await upstream.arrayBuffer());
      const persistedBody = fullBody.subarray(0, config.responseBodyMaxBytes);
      const outcome = upstream.status >= 500 ? 'FAILED' : 'COMMITTED';
      await settle(db, receipt, outcome, { upstreamStatus: upstream.status, headers: storedHeaders(upstream), body: persistedBody, truncated: fullBody.length > persistedBody.length });
      upstream.headers.forEach((value, name) => reply.header(name, value));
      return reply.code(upstream.status).send(fullBody);
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === 'TimeoutError';
      const code = (error as { cause?: { code?: string } }).cause?.code;
      const status = timeout || code !== 'ECONNREFUSED' ? 'UNKNOWN' : 'FAILED';
      try { await settle(db, receipt, status); } catch (settleError) { request.log.error({ err: settleError, operation: 'settle_failure', receiptId: receipt.id }, 'Could not record upstream failure'); }
      request.log.warn({ err: error, operation: 'forward', receiptId: receipt.id, outcome: status }, 'Upstream request did not complete');
      if (status === 'UNKNOWN') return problem(reply, 504, 'outcome-unknown', 'Upstream outcome is unknown', 'The upstream response timed out or failed ambiguously; OnceGate will not retry it.', { resolve: `/v1/receipts/${receipt.id}` });
      return problem(reply, 502, 'upstream-unavailable', 'Upstream unavailable', 'The upstream refused the connection before execution.');
    }
  };
}
