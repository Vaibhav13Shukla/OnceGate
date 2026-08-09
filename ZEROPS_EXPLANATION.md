# How OnceGate Uses Zerops

OnceGate relies on **Zerops** as its cloud infrastructure platform to power a production-grade 5-service architecture:

## 1. Managed Infrastructure Services
- **`db` (Managed PostgreSQL 16)**: Houses OnceGate's durable receipt storage, audit event log tables, and unique constraint concurrency arbitration. Zerops automatically handles volume persistence, environment credential generation (`${db_user}`, `${db_password}`), and database health monitoring.
- **`cache` (Managed Valkey 8)**: Operates as an in-memory key-value cache connected over Zerops' high-speed internal network for hot-path receipt replays.

## 2. Node.js Application Services
- **`gate` (`nodejs@22`)**: Runs OnceGate's core Fastify reverse proxy gateway. Configured in `zerops.yml` with automated database migrations executed via `initCommands` (`node apps/gate/dist/scripts/migrate.js`) and HTTP health checks on `/healthz`.
- **`checkout` (`nodejs@22`)**: Operates the upstream mock payment service used for integration testing and chaos injection (`slow`, `flaky`, `die`).

## 3. Static SPA Frontend Service
- **`console` (`static`)**: Builds OnceGate's React 19 Ops Console SPA with Vite (`npm run build -w @oncegate/console`) and serves static HTML/CSS/JS assets with SPA routing redirects (`/* -> /index.html`).

## 4. Zerops Internal VXLAN Networking
OnceGate leverages Zerops' private VXLAN cross-service networking (`http://checkout:3100`, `db:5432`). Upstream payment services remain private and unexposed, while `gate` and `console` expose public subdomains to clients and operators.
