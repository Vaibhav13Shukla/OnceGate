# ADR-0004: Treat upstream 4xx responses as COMMITTED, not FAILED

## Status

Accepted

## Context

When the upstream returns a 4xx status code (e.g., 400 Bad Request, 404 Not Found, 429 Too Many Requests), the question is whether the receipt should be recorded as COMMITTED or FAILED.

## Alternatives considered

- **Mark as FAILED**: would allow retries with the same key, but a 4xx is a definite, deterministic outcome — retrying will produce the same result. This wastes upstream resources and violates the draft's intent.
- **Mark as COMMITTED**: correctly models that the upstream received and processed the request, producing a definite outcome.

## Decision

Any upstream response with status < 500 is COMMITTED. Only 5xx responses are FAILED. The IETF Idempotency-Key draft specifies: "return the result of the previously completed operation" — success or error. A 422 Unprocessable Entity from the upstream is as definite as a 201 Created.

## Consequences

Retries of a key whose upstream returned 4xx will receive the stored 4xx response with `OnceGate-Replayed: true`. Clients that need to change the request must use a new idempotency key. This matches Stripe's documented behavior and the draft's intent.
