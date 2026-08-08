# ADR-0003: Model ambiguous outcomes as UNKNOWN rather than auto-retrying or swallowing

## Status

Accepted

## Context

When the gateway forwards a request and the upstream times out, crashes, or the network drops, the outcome is genuinely ambiguous: the upstream may or may not have executed the side effect. Most idempotency middleware either silently discards the attempt (losing evidence) or auto-retries (risking duplication).

## Alternatives considered

- **Auto-retry on timeout**: risks executing the side effect twice if the upstream completed but the response was lost.
- **Mark as FAILED and allow retry**: risks the same double execution — the charge may exist even though the response never arrived.
- **Discard the receipt**: loses all evidence that the operation was attempted.

## Decision

Introduce an explicit UNKNOWN state. A receipt becomes UNKNOWN when the outcome is genuinely ambiguous (timeout, crash, network failure where execution cannot be ruled out). UNKNOWN receipts:

1. Are never auto-retried by OnceGate.
2. Block further attempts with the same key (409).
3. Are surfaced in the console for human resolution.
4. Can be resolved to COMMITTED or FAILED via the control API with a mandatory audit note.

## Consequences

Operators must manually investigate UNKNOWN receipts. This is a deliberate trade: operational effort in the rare ambiguous case versus silent data corruption. The UNKNOWN state is the core intellectual contribution of OnceGate's design — it is what separates truthful outcome tracking from response caching.
