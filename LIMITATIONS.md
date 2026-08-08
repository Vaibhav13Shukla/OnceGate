# Limitations

- OnceGate cannot guarantee exactly-once upstream side effects. It provides at-most-once forwarding per key while a receipt is retained.
- A timeout, connection reset, or process crash after forwarding can be ambiguous. Such receipts are `UNKNOWN`, never auto-retried.
- The default receipt TTL is 24 hours. After expiry, the same key can be used as a new operation.
- Stored response bodies are capped at 256 KiB. First responses are delivered in full, but a truncated stored receipt cannot reproduce bytes beyond the cap.
- A database outage fails closed with `503`; availability is intentionally sacrificed to avoid an unrecorded forward.
- The MVP has one tenant (`default`) and a single static admin bearer token. Browser operators must enter the token per tab; it is not embedded in the console build.
- When console and gate use different origins, `CORS_ORIGIN` must be set precisely to the console URL; wildcard CORS is not enabled by default.
- No rate limiting, upstream authentication, or multi-region/high-availability deployment is included.
