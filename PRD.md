# Product Requirements Document (PRD) — OnceGate

## 1. Problem & Core Target Users
Web API clients (e.g., payment checkouts, e-commerce applications) frequently retry mutating HTTP requests due to network disconnects, timeouts, or client refreshes. Standard framework middleware relies on volatile in-memory or Redis caches that lose evidence on restart or swallow ambiguous failures.

OnceGate provides a PostgreSQL-backed reverse proxy implementing the IETF `Idempotency-Key` specification (`draft-ietf-httpapi-idempotency-key-header-07`).

## 2. Functional Requirements
1. **Proxy Execution (`/p/*`)**: Intercept `POST`, `PUT`, `PATCH` requests containing `Idempotency-Key` headers (and optional `X-Tenant-Id`).
2. **SHA-256 Fingerprinting**: Calculate a SHA-256 hash over `(method, path, body)`. Mismatched payloads for an existing key must return `422 Unprocessable Entity`.
3. **Atomic Concurrency Arbitration**: Perform atomic database claims using PostgreSQL `UNIQUE (tenant, idempotency_key)`.
4. **In-Flight Locking**: Concurrent duplicate requests received while an initial request is `PENDING` must return `409 Conflict` + `Retry-After: 2`.
5. **Durable Replays**: Replayed responses must reproduce the stored status code, allowlisted headers, body (up to 256 KiB), and append `OnceGate-Replayed: true`.
6. **Honest `UNKNOWN` Lifecycle**: Upstream timeouts or network failures transition the receipt state to `UNKNOWN` and return `504 Gateway Timeout`. Automatic retries are blocked until manual operator resolution.
7. **Control API (`/v1/*`)**: Provide administrative endpoints (`/v1/stats`, `/v1/receipts`, `/v1/receipts/:id`, `/v1/receipts/:id/resolve`) protected by Bearer token authentication.
8. **Background Sweeping**: Evict expired receipts past `KEY_TTL_HOURS` and mark stale `PENDING` receipts past `execution_deadline` as `UNKNOWN`.

## 3. Non-Functional Requirements
- **Durability**: PostgreSQL ACID transaction guarantees for all receipt state transitions.
- **Fail-Closed Availability**: Return `503 Service Unavailable` on database connection failure to prevent un-deduplicated upstream execution.
- **Latency**: Gateway proxy processing overhead < 10ms p95.
- **Security**: Capped `X-Tenant-Id` header (max 128 chars), Bearer token authentication on control API, strict CORS rules.

## 4. Explicit Non-Goals
- Automatic client retries of `UNKNOWN` state receipts.
- Un-deduplicated execution during database outages (fail-open is explicitly rejected).
- Direct client SDK requirements (gateway operates strictly over standard HTTP).

## 5. Testable Success Criteria
- 100% test pass rate across unit and integration test suites.
- Clean TypeScript build without compiler errors.
- Fully functional static SPA Ops Console for monitoring traffic and resolving `UNKNOWN` receipts.
