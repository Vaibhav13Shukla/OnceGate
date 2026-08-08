# Error registry

All errors are RFC 9457 `application/problem+json` with types rooted at `https://github.com/vaibhav/oncegate/blob/main/docs/errors.md#`.

| Suffix | Status | Meaning |
|---|---:|---|
| `invalid-idempotency-key` | 400 | Missing in strict mode, blank, or over 255 characters. |
| `in-flight` | 409 | The original matching request is still pending. |
| `fingerprint-mismatch` | 422 | A key was reused with a different method, path, or body. |
| `outcome-unknown` | 409 / 504 | A receipt is unresolved, or a forward timed out ambiguously. |
| `receipt-store-unavailable` | 503 | PostgreSQL could not record the claim; request was not forwarded. |
| `upstream-unavailable` | 502 | The upstream was definitely unavailable before execution. |
