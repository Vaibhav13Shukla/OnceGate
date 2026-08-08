# OnceGate

> **Durable HTTP Idempotency Gateway** — A PostgreSQL-backed reverse proxy enforcing the IETF `Idempotency-Key` specification for mutating APIs on Zerops.

---

## ⚡ Overview

**OnceGate** makes mutating HTTP API calls (POST/PUT/PATCH) safe to retry. It uses **PostgreSQL** as the sole concurrency arbiter:
- Durably claims an `Idempotency-Key` via `INSERT ... ON CONFLICT DO NOTHING`.
- Forwards at most once per key within its TTL.
- Records the response and replays it on subsequent retries with `OnceGate-Replayed: true`.
- Enforces honest `UNKNOWN` outcome tracking: if an upstream timeout or crash makes execution ambiguous, retries are blocked (`409 Conflict`) until an operator manually audits and resolves the receipt.

---

## 🏗️ Zerops Native Architecture

OnceGate runs natively on **Zerops** across 4 dedicated microservice containers communicating over Zerops's private VXLAN network without proprietary SDKs:

```
                      ┌──────────────────────────────────────────────┐
                      │              Zerops L7 Balancer              │
                      └──────┬────────────────────────────────┬──────┘
                             │                                │
                      Public │                                │ Public
                             ▼                                ▼
                ┌──────────────────────────┐    ┌──────────────────────────┐
                │      console:static      │    │      gate:nodejs@22      │
                │  (Ops Console Control)   │    │  (Idempotency Proxy)     │
                └──────────────────────────┘    └────────────┬─────────────┘
                                                             │
                                               Private VXLAN │ db:5432
                                               (checkout:3100)│
                                                             ▼
                                                ┌──────────────────────────┐
                                                │      db:postgresql@16    │
                                                │   (Durable Receipt ACID) │
                                                └──────────────────────────┘
                                                             ▲
                                                             │ db:5432
                                                ┌────────────┴─────────────┐
                                                │    checkout:nodejs@22    │
                                                │  (Upstream Demo Service) │
                                                └──────────────────────────┘
```

---

## 📋 Core Guarantees & Protocol Compliance

- **Atomic Claims**: Concurrency arbitrated by PostgreSQL `UNIQUE (tenant, idempotency_key)`, not process memory or volatile Redis keys.
- **Durable Replays**: Matching key & payload returns stored response with `OnceGate-Replayed: true` and `OnceGate-Receipt: <id>`.
- **In-Flight Conflict Protection**: Simultaneous duplicate requests while a key is `PENDING` receive `409 Conflict` with `Retry-After: 2`.
- **Payload Locking (sha256)**: Reusing a key with a different HTTP method, path, or request body returns `422 Unprocessable Entity`.
- **Honest UNKNOWN State**: Ambiguous timeouts return `504 Gateway Timeout` and transition the receipt to `UNKNOWN`. Auto-retries are blocked until an operator manually resolves the state with an audit note.
- **Fail-Closed Design**: If PostgreSQL is down, mutating requests receive `503 Service Unavailable` — OnceGate will never forward a request without a durable receipt claim.

---

## 🤖 AI Agent Transparency & Development Workflow

As encouraged in the Zerops Challenge criteria, **OnceGate** was engineered with AI coding agents operating as senior developer power users:

- **AI Tools Used**: Claude Code & Google Antigravity (AGY).
- **Agent Responsibilities**:
  - Codebase generation, TypeScript strict typing, and Fastify proxy handler implementation.
  - Conformance test suite creation (`tests/integration/gateway.test.ts`) covering all 11 IETF draft scenarios.
  - Zerops ZCP manifest authoring (`zerops.yml` and `zerops-project-import.yml`) with Zerops native environment reference interpolation (`${db_user}:${db_password}@db:5432/${db_name}`).

---

## 🚀 1-Click Zerops Deployment

OnceGate includes full Zerops ZCP manifests for zero-manual-plumbing deployment:

1. **Import Project**: Import `zerops-project-import.yml` into your Zerops workspace. This provisions `db` (PostgreSQL 16), `checkout` (Node 22), `gate` (Node 22), and `console` (Static).
2. **Build & Deploy**: Zerops builds services automatically via `zerops.yml`. Database migrations are executed automatically on `gate` startup (`node apps/gate/dist/scripts/migrate.js`).
3. **Access App**: Open the public subdomain generated for `console` to access the live Ops Console.

---

## 💻 Local Development & Testing

```bash
# 1. Install dependencies
npm install

# 2. Start local PostgreSQL
docker compose up -d db

# 3. Run database migrations
$env:DATABASE_URL='postgres://oncegate:oncegate@localhost:54329/oncegate_test'
npm run migrate

# 4. Build all monorepo packages
npm run build

# 5. Run IETF Conformance Integration Test Suite
$env:TEST_DATABASE_URL='postgres://oncegate:oncegate@localhost:54329/oncegate_test'
npm run test:integration
```

---

## 📖 Judging Q&A & Design Decisions

Detailed answers to architectural questions (why PostgreSQL vs Redis, why UNKNOWN state over auto-retry, why 4xx is COMMITTED) are documented in [`docs/judge-qa.md`](file:///c:/Users/LENOVO/OneDrive/Documents/ChatGPT/OnceGate/docs/judge-qa.md).
