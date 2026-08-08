# Judge Q&A

Pre-answered questions about OnceGate's design.

## Why not Temporal / Restate / Inngest?

They solve durable *workflows* and require restructuring code around their SDKs. OnceGate absorbs exactly one responsibility — duplicate-safe HTTP — at the proxy layer, zero code changes to the upstream. Different point on the adoption-cost curve.

## Isn't this just idempotent-proxy?

`ldclabs/idempotent-proxy` is the closest prior art and is credited in the README. Key differences:

- **Durable receipts**: Postgres with ACID guarantees vs Redis/Durable Objects cache semantics.
- **State machine**: Explicit PENDING → COMMITTED | FAILED | UNKNOWN lifecycle. `idempotent-proxy` has none.
- **Fingerprint enforcement**: 422 on key reuse with a different payload.
- **IETF-draft scenario tests**: Executable conformance suite.
- **Ops console**: Receipt browser with human resolution of UNKNOWN outcomes.
- **General-web focus** vs blockchain RPC orientation.

## Exactly-once?

Impossible to guarantee from outside the upstream, so OnceGate does not claim it. The guarantee is: at-most-once forwarding per key within TTL, plus durable truthful receipts. The UNKNOWN state exists precisely because we refuse to lie about the ambiguous case.

## What if OnceGate itself is down?

Clients hit the upstream directly or fail — no worse than today. OnceGate is a deliberate single point of *correctness*, and fail-closed on DB loss is a documented trade (correctness over availability). The HA path is straightforward: multiple gate replicas are safe because the unique constraint in PostgreSQL is the concurrency arbiter — that is why the claim is a DB insert and not in-memory state.

## Why PostgreSQL and not Redis?

Receipts are records, not cache. Eviction of a receipt means a possible double charge. ACID transactions and a unique constraint provide atomic claim semantics for free. Redis was rejected as the primary store because eviction and restart lose receipts — that is the exact failure mode of the incumbent framework middlewares.

## Response body storage cost?

Capped at 256 KiB with a `response_truncated` boolean flag. TTL cleanup (default 24 hours) keeps storage bounded. Documented in LIMITATIONS.md.

## Why 4 services?

Each is justified:

- **gate** — the product itself. Removing it removes the project.
- **db** — durable receipts. Without it, receipts die on restart.
- **checkout** — demo upstream. Dedupe must be proven across a real network hop, not in-process.
- **console** — judges and the demo video need to *see* prevented duplicates; the ops view is part of the product.

The background sweeper deliberately runs inside gate rather than as a fifth service — a separate worker would be architecture padding.

## Security?

MVP: admin bearer token on the control surface; proxy surface inherits upstream auth by forwarding headers. Multi-tenant auth is on the roadmap and noted in LIMITATIONS.md.

## Why is this worth existing after the weekend?

The IETF Idempotency-Key draft is heading to RFC. Every language re-implements this pattern as framework-specific cache middleware. A spec-conformant, durable, self-hostable reference layer is the missing boring infrastructure. Roadmap: conformance suite as standalone repo, Valkey hot-path cache, multi-tenant keys, Helm charts.
