# OnceGate

PostgreSQL-backed reverse proxy enforcing the IETF `Idempotency-Key` specification for mutating HTTP APIs on Zerops.

## What it does

OnceGate sits between clients and mutating backend services (`POST`, `PUT`, `PATCH`). It ensures that retried HTTP requests execute at most once per idempotency key and return identical responses.

- **Atomic claims**: Uses PostgreSQL `UNIQUE (tenant, idempotency_key)` constraints to arbitrate concurrency.
- **Payload locking**: Computes a SHA-256 fingerprint of the method, path, and request body. Reusing a key with a modified payload returns `422 Unprocessable Entity`.
- **In-flight locking**: Concurrent duplicate requests received while an initial request is processing return `409 Conflict` with a `Retry-After` header.
- **Durable replays**: Replayed requests return the original status code and headers with `OnceGate-Replayed: true`.
- **Honest UNKNOWN state**: If an upstream call times out or drops mid-flight, the receipt transitions to `UNKNOWN` and returns `504 Gateway Timeout`. Automatic retries are blocked until an operator resolves the outcome manually in the console.
- **Fail-closed security**: If PostgreSQL is unreachable, mutating requests return `503 Service Unavailable` rather than risking un-deduplicated upstream side effects.

## System Architecture

OnceGate runs on Zerops across five services connected over a private VXLAN network (`db:5432`, `cache:6379`, `checkout:3100`):

```
                   +---------------------------------------+
                   |          Zerops L7 Balancer           |
                   +-------+-----------------------+-------+
                           |                       |
                    Public |                       | Public
                           v                       v
            +--------------------+   +--------------------+
            |   console:static   |   |   gate:nodejs@22   |
            | (Ops Console UI)   |   | (Reverse Proxy)    |
            +--------------------+   +----------+---------+
                                                |
                                  Private VXLAN | db:5432
                                  (checkout:3100| cache:6379)
                                                v
                                     +--------------------+
                                     |  db:postgresql@16  |
                                     |  (Receipt Store)   |
                                     +--------------------+
                                                ^
                                                | db:5432
                                     +----------+---------+
                                     | checkout:nodejs@22 |
                                     | (Upstream Demo)    |
                                     +--------------------+
```

- **`gate`**: Fastify reverse proxy verifying keys, hashing payloads, and storing receipt lifecycle state.
- **`cache`**: Valkey 8 container serving sub-millisecond hot-path receipt reads.
- **`db`**: PostgreSQL 16 database storing receipt history, status transitions, and audit event logs.
- **`checkout`**: Upstream Node.js payment service used for integration testing and chaos simulation.
- **`console`**: React dashboard for monitoring traffic metrics, inspecting audit event trails, and resolving `UNKNOWN` receipts.

## Deploying on Zerops

1. **Import configuration**: Import `zerops-project-import.yml` into your Zerops project. This provisions `db`, `cache`, `gate`, `checkout`, and `console`.
2. **Deploy project**: Push to your repository. Zerops builds all services using `zerops.yml` and runs database migrations on startup.
3. **Open console**: Navigate to the public URL assigned to `console` to access the management interface.

## Local Development

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

### Setup & Testing

```bash
# Install dependencies
npm install

# Start local PostgreSQL container
docker compose up -d db

# Run database migrations
$env:DATABASE_URL="postgres://oncegate:oncegate@localhost:54329/oncegate_test"
npm run migrate

# Build packages
npm run build

# Run integration test suite
$env:TEST_DATABASE_URL="postgres://oncegate:oncegate@localhost:54329/oncegate_test"
npm run test:integration
```

## AI Tool Attribution

OnceGate was developed with assistance from AI coding agents (Claude Code and Antigravity). The agents were used to implement Fastify proxy routes, write PostgreSQL schema migrations, build the Vitest IETF integration test suite, and author Zerops deployment manifests.
