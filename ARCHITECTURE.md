# Architecture & Technology Stack — OnceGate

```text
                                  +------------------------------------+
                                  |         Vercel / L7 Balancer       |
                                  +-----------------+------------------+
                                                    |
                         +--------------------------+--------------------------+
                         | Static SPA / Proxy                                  | Direct Backend
                         v                                                     v
             +-----------------------+                             +-----------------------+
             |     apps/console      |                             |       apps/gate       |
             |   (React 19 / Vite)   |                             | (Fastify Proxy Core)  |
             |   Static Control UI   |                             +-----------+-----------+
             +-----------+-----------+                                         |
                         |                                                     v
                         | API Calls (/v1/*, /p/*)                 +-----------------------+
                         +---------------------------------------->|     PostgreSQL        |
                                                                   |  (Receipt Store & DB) |
                                                                   +-----------+-----------+
                                                                               |
                                                                               v
                                                                   +-----------------------+
                                                                   |     apps/checkout     |
                                                                   | (Upstream Demo API)   |
                                                                   +-----------------------+
```

## Stack Decisions & Rationale

| Layer | Choice | Alternatives Rejected | Rationale |
| :--- | :--- | :--- | :--- |
| **Language** | TypeScript 5 / Node.js 22 | Go, Python, Rust | Team familiarity, async I/O performance, native fetch/crypto support. |
| **Web Server** | Fastify 5 | Express, NestJS, Koa | Low overhead, high throughput, built-in schema parsing, first-class CORS support. |
| **Database** | PostgreSQL 16 | Redis, MongoDB, DynamoDB | Durability requirement. `UNIQUE (tenant, idempotency_key)` constraints provide atomic claim semantics; ACID transactions ensure truthful audit event logs. |
| **Frontend** | React 19 + Vite 6 | Next.js, Remix | Static SPA output is lightweight, fast, and deploys natively on CDNs (Vercel static) without serverless cold start issues. |
| **Testing** | Vitest 4 | Jest, Mocha | Lightning-fast TypeScript execution, native ESM support, clean global mock integration. |

## Runtime Compatibility & Host Assignment
- **`apps/console`**: Static SPA built with Vite. Compatible with Vercel CDN static hosting.
- **`apps/gate`**: Long-running Node.js process with background sweeper timers (`setInterval`) and persistent PostgreSQL connection pooling. Deployed on persistent Node runtime platforms (Zerops, Docker, Render, Railway).
- **`apps/checkout`**: Upstream demo backend service running on persistent Node runtime.
