# OnceGate

OnceGate is a reverse proxy that makes mutating HTTP API calls safe to retry. It uses PostgreSQL as the sole concurrency arbiter: it durably claims an `Idempotency-Key`, forwards at most once per key within its TTL, records the outcome, and replays the recorded response.

It does **not** claim exactly-once side effects. If an upstream timeout or crash makes the outcome ambiguous, the receipt becomes `UNKNOWN`; OnceGate will never automatically forward that key again.

## Guarantees

- Atomic claim through `UNIQUE (tenant, idempotency_key)`, not process memory.
- Same key and fingerprint: replay the durable response with `OnceGate-Replayed: true`.
- In-flight duplicate: `409` with `Retry-After: 2`, never a second upstream call.
- Same key with a different method, path, or raw request body: `422`.
- Ambiguous timeout: `504` plus a durable `UNKNOWN` receipt; manual resolution is audited.
- PostgreSQL outage: `503` and no forwarding (fail closed).

The fingerprint is `sha256(method + "\\n" + normalized_path + "\\n" + raw_body_bytes)`. Headers are intentionally excluded because retry headers commonly vary.

## Local development

```bash
npm install
docker compose up -d db
$env:DATABASE_URL='postgres://oncegate:oncegate@localhost:54329/oncegate_test'
$env:UPSTREAM_BASE_URL='http://localhost:3100'
$env:ADMIN_TOKEN='change-me'
npm run migrate
npm run build
```

Run checkout with the same `DATABASE_URL`, then run gate. Unit checks: `npm test`. The real-PostgreSQL conformance suite is `npm run test:integration`; it deliberately fails if the database is unavailable.

## API

`ANY /p/*` forwards to `UPSTREAM_BASE_URL` with `/p` stripped. Safe methods bypass receipts. Control endpoints require `Authorization: Bearer <ADMIN_TOKEN>`:

- `GET /v1/receipts?status=&limit=&cursor=` — receipt feed.
- `GET /v1/receipts/:id` — receipt and audit events.
- `POST /v1/receipts/:id/resolve` — resolves `UNKNOWN` to `COMMITTED` or `FAILED` with a non-empty note.
- `GET /v1/stats` — durable duplicate-prevention counters.
- `GET /healthz` — database-aware health check.

## Positioning

Framework middleware requires every application stack to implement this protocol. `ldclabs/idempotent-proxy` is acknowledged prior proxy art; OnceGate differs by using ACID PostgreSQL receipts, an explicit `PENDING → COMMITTED|FAILED|UNKNOWN` lifecycle, `422` fingerprint enforcement, and human resolution of ambiguity. It is not a workflow engine, queue, rate limiter, or API gateway framework.

## Zerops

`zerops-project-import.yml` provisions the four services. `zerops.yml` describes their builds. Before deployment, set real `DATABASE_URL`, `ADMIN_TOKEN`, `UPSTREAM_BASE_URL`, `CORS_ORIGIN` (the console URL), and the console build-time `VITE_GATE_URL` in Zerops; no deployment credentials are stored in this repository.
