# OnceGate

PostgreSQL-backed reverse proxy enforcing the IETF `Idempotency-Key` specification for mutating HTTP APIs on Zerops.

## What it does

OnceGate sits between clients and mutating backend services (`POST`, `PUT`, `PATCH`). It ensures that retried HTTP requests execute at most once per idempotency key and return identical responses.

- **Atomic claims**: Uses PostgreSQL `UNIQUE (tenant, idempotency_key)` constraints to arbitrate concurrency.
- **Payload locking**: Computes a SHA-256 fingerprint of the method, path, and request body. Reusing a key with a modified payload returns `422 Unprocessable Entity`.
- **In-flight locking**: Concurrent duplicate requests received while an initial request is processing return `409 Conflict` with a `Retry-After` header.
- **Durable replays**: Replayed requests return the original status code and headers with `OnceGate-Replayed: true`.
- **Honest UNKNOWN state**: If an upstream call times out or drops mid-flight, the receipt transitions to `UNKNOWN` and returns `504 Gateway Timeout`. Automatic retries are blocked until an operator resolves the outcome manually in the console.
- **Measurable Before/After Proof (Brace Moment)**: Interactive studio proving that retrying a lost response **Without OnceGate** creates **2 duplicate database charges**, while retrying **With OnceGate** creates **0 duplicate charges** (`charge_count = 1`).
- **Failure Lab & Chaos Studio**: Integrated controls to inject lost responses (`x-chaos: drop`), concurrent storms (25x parallel requests), upstream timeouts, process crashes, and payload mismatches.
- **Evidence-Grounded AI Diagnostics**: Read-only AI assistant ("Explain Outcome") summarizing real PostgreSQL timeline evidence without fabricating facts or controlling deterministic state machine logic.
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
- **`console`**: React 19 dashboard for monitoring traffic metrics, inspecting audit event trails, executing Failure Lab scenarios, and resolving `UNKNOWN` receipts.

## Transparent Boundaries (What OnceGate Cannot Know)

If the gateway forwards a request to an upstream service and the connection drops before HTTP headers arrive, OnceGate cannot determine from outside whether the upstream executed the side-effect. Rather than guessing or auto-retrying (which risks double charging), OnceGate durably transitions the receipt to `UNKNOWN` and blocks further attempts until an operator inspects database logs and records an audited resolution.

## Deploying on Zerops

1. **Import configuration**: Import `zerops-project-import.yml` into your Zerops project. This provisions `db`, `cache`, `gate`, `checkout`, and `console`.
2. **Deploy project**: Push to your repository. Zerops builds all services using `zerops.yml` and runs database migrations on startup.
3. **Open console**: Navigate to the public URL assigned to `console` to access the management interface.

## AI Tool Attribution

OnceGate was developed with assistance from AI coding agents (Claude Code and Antigravity). The agents were used to implement Fastify proxy routes, write PostgreSQL schema migrations, build the Failure Lab chaos suite, and author Zerops deployment manifests.
