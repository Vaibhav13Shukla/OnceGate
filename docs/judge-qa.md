# Judge Q&A & Architecture Defense — OnceGate

This document provides technical defenses for OnceGate's design choices.

---

## 1. Why PostgreSQL for Receipts and Not Redis/Valkey?
- **Durability & Correctness**: Idempotency receipts are authoritative transaction records, not temporary cache entries. If a cache evicts a receipt or drops data on restart, duplicate client requests will execute twice (causing double charges).
- **Atomic Concurrency Arbitration**: PostgreSQL provides built-in `UNIQUE (tenant, idempotency_key)` constraints. Attempting a receipt claim is an atomic SQL `INSERT ... ON CONFLICT DO NOTHING`. PostgreSQL acts as the single source of truth for concurrency control across multiple gate replicas without needing distributed locks.
- **Valkey Role**: Valkey 8 is used strictly as a fast read-through cache for already COMMITTED receipts, while PostgreSQL remains the durable source of truth.

---

## 2. Why Does the `UNKNOWN` State Exist? (Timeout vs 5xx)
- **The Ambiguity Problem**: When OnceGate forwards a request to an upstream service and the HTTP connection times out or drops mid-flight, the outcome is genuinely ambiguous. The upstream *may* have executed the side-effect before dropping, or it *may not*.
- **Why 5xx is `FAILED`**: An upstream 500 error returns a definite HTTP response. Retries under the same key are marked `FAILED` and allowed to re-execute.
- **Why Timeout is `UNKNOWN`**: Discarding the receipt or auto-retrying risks double execution. OnceGate transitions the receipt state to `UNKNOWN` and returns `504 Gateway Timeout`. Automatic retries are blocked until a human operator inspects the upstream and resolves the state (`COMMITTED` or `FAILED`) via the Control API.

---

## 3. At-Most-Once vs Exactly-Once Guarantees
- **No False Claims**: "Exactly-once" delivery is mathematically impossible across arbitrary network boundaries without distributed transactional coupling (e.g., 2PC). OnceGate does not claim exactly-once.
- **The Guarantee**: OnceGate guarantees **at-most-once execution** per key within its TTL window, plus truthful receipt history. The `UNKNOWN` state exists specifically because OnceGate refuses to lie about ambiguous network outcomes.

---

## 4. Why 5 Services on Zerops?
Each service earns its existence:
1. **`db` (PostgreSQL 16)**: Authoritative durable receipt store, ACID transaction processing, unique constraint claim arbiter.
2. **`cache` (Valkey 8)**: Sub-millisecond hot-path cache for completed receipt replays.
3. **`gate` (Node.js 22)**: Core proxy gateway, SHA-256 fingerprinting engine, state machine, background sweeper.
4. **`checkout` (Node.js 22)**: Mock upstream payment API with chaos injection (`slow`, `flaky`, `die`). Proves deduplication across real network hops.
5. **`console` (Static SPA)**: Operator React dashboard for monitoring traffic storms and resolving `UNKNOWN` receipts.

---

## 5. What Happens When PostgreSQL Fails? (Fail-Closed)
- **Fail-Closed Strategy**: If PostgreSQL is unreachable, mutating requests return `503 Service Unavailable`.
- **Rationale**: Passing requests to the upstream without idempotency checking risks silent double execution during DB outages. Correctness is strictly prioritized over availability.
