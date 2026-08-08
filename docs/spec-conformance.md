# Conformance mapping

The integration suite at `tests/integration/gateway.test.ts` runs against PostgreSQL and verifies the key scenarios: safe-method bypass, claim/forward/replay, fingerprint mismatch, 25-way duplicate storm, timeout-to-UNKNOWN, and authenticated resolution. It operationalizes the IETF Idempotency-Key draft’s first request, completed replay, concurrent duplicate, and mismatch scenarios.

`npm run test:integration` intentionally has a real PostgreSQL prerequisite; it is not replaced by a mock or skipped when the database is absent.
