# ADR-0001: Use PostgreSQL receipts as the forwarding arbiter

## Status

Accepted

## Context

Retries and concurrent requests must not produce an unrecorded second forward. Receipts must survive process restarts and must model an ambiguous upstream outcome.

## Alternatives considered

- In-process map — simple, but loses claims on restart and cannot coordinate replicas.
- Redis response cache — fast, but eviction and persistence configuration make it the wrong durability boundary for payment-shaped operations.
- PostgreSQL receipt table — durable and transactional, with a unique constraint providing an atomic claim.

## Decision

Use a PostgreSQL `receipts` table with a unique `(tenant, idempotency_key)` constraint. The gateway claims with `INSERT ... ON CONFLICT DO NOTHING` before any upstream forwarding.

## Consequences

The gateway fails closed when PostgreSQL is unavailable. This trades availability for the documented correctness boundary, and permits multiple gateway replicas without a distributed lock.
