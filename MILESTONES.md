# Milestones & Acceptance Plan — OnceGate

## Milestone 1: Core Proxy Engine & PostgreSQL Claims
- **Objective**: Implement `apps/gate` core proxy, PostgreSQL schema migrations (`001_init.sql`, `002_events_receipt_id_index.sql`), SHA-256 fingerprinting, and atomic claim logic.
- **Acceptance Checks**:
  - `POST /p/*` with new `Idempotency-Key` forwards to upstream and returns `OnceGate-Receipt`.
  - Duplicate requests replay stored status and headers with `OnceGate-Replayed: true`.
  - Mismatched payload for an existing key returns `422 Unprocessable Entity`.
  - Concurrent duplicate requests return `409 Conflict` + `Retry-After: 2`.

## Milestone 2: Control API & Resolution Engine
- **Objective**: Implement `/v1/stats`, `/v1/receipts`, `/v1/receipts/:id`, and `/v1/receipts/:id/resolve` routes inside `apps/gate/src/control.ts`.
- **Acceptance Checks**:
  - Control endpoints reject unauthenticated requests with `401 Unauthorized`.
  - Resolving an `UNKNOWN` receipt updates status to `COMMITTED` or `FAILED` within an atomic SQL transaction.
  - Resolving a non-`UNKNOWN` receipt returns `409 Conflict`.

## Milestone 3: React Ops Console SPA
- **Objective**: Build `apps/console` UI for traffic monitoring, cURL snippet generation, traffic simulation, and `UNKNOWN` state resolution.
- **Acceptance Checks**:
  - `npm run build` compiles React SPA output to `apps/console/dist` and copies to root `./dist`.
  - Static SPA renders cleanly in browser without console errors.

## Milestone 4: Security, Durability & Test Hardening
- **Objective**: Add integration test suite (`tests/integration/gateway.test.ts`), tenant header isolation, PostgreSQL SSL support, and fail-closed database handling.
- **Acceptance Checks**:
  - `npm run test` (unit tests) passes 100%.
  - `npm run test:integration` passes 16/16 tests.
  - Database connection outage returns `503 Service Unavailable`.

## Milestone 5: Production Deployment & Verification
- **Objective**: Deploy static SPA to Vercel CDN and persistent gateway services to production environment.
- **Acceptance Checks**:
  - Monorepo production build succeeds cleanly (`npm run build`).
  - Production URL opens and responds with HTTP 200 OK.
