import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig, type Config } from './config.js';
import { registerControlRoutes } from './control.js';
import { createPool, type Database } from './db.js';
import { proxyHandler } from './proxy.js';
import { markStalePendingUnknown, purgeExpiredReceipts } from './sweeper.js';

export function buildServer(options: { config?: Config; db?: Database } = {}) {
  const config = options.config ?? loadConfig();
  const db = options.db ?? createPool(config.databaseUrl);
  const app = Fastify({ logger: true });
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
  if (config.corsOrigin) app.register(cors, { origin: config.corsOrigin, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Chaos', 'X-Tenant-Id'], exposedHeaders: ['OnceGate-Receipt', 'OnceGate-Replayed', 'OnceGate-Bypassed', 'OnceGate-Warning'] });
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
  app.get('/', async () => ({ name: 'OnceGate API Gateway', version: '0.1.0', status: 'online', docs: 'https://github.com/Vaibhav13Shukla/OnceGate' }));
  app.get('/api', async () => ({ name: 'OnceGate API Gateway', version: '0.1.0', status: 'online' }));
  app.get('/healthz', async (_request, reply) => {
    try { await db.query('SELECT 1'); return { ok: true, db: true }; }
    catch (error) { app.log.error({ err: error, operation: 'healthcheck' }, 'Database health check failed'); return reply.code(503).send({ ok: false, db: false }); }
  });
  app.all('/p/*', proxyHandler(db, config));
  registerControlRoutes(app, db, config.adminToken);
  const timer = setInterval(() => {
    markStalePendingUnknown(db).catch((error) => app.log.error({ err: error, operation: 'pending_sweeper' }, 'Pending receipt sweeper failed'));
    purgeExpiredReceipts(db).catch((error) => app.log.error({ err: error, operation: 'expiry_sweeper' }, 'Expired receipt purge failed'));
  }, 5_000);
  if (typeof timer.unref === 'function') timer.unref();
  app.addHook('onClose', async () => { clearInterval(timer); if (!options.db) await db.end(); });
  return app;
}

if (!process.env.VERCEL && process.argv[1]?.endsWith('server.js')) {
  const app = buildServer();
  app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) }).catch((error) => { app.log.error(error); process.exit(1); });
}
