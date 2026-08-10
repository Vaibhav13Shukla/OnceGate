import Fastify from 'fastify';
import pg from 'pg';

export function buildCheckoutApp(options: { databaseUrl?: string; db?: pg.Pool } = {}) {
  const app = Fastify({ logger: true });

  const dbUrl = options.databaseUrl || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;

  const needsSsl = dbUrl && (
    dbUrl.includes('supabase') ||
    dbUrl.includes('pooler') ||
    dbUrl.includes('sslmode') ||
    dbUrl.includes('.com') ||
    process.env.VERCEL === '1'
  );

  const db = options.db || new pg.Pool({
    connectionString: dbUrl || 'postgres://localhost:5432/oncegate_test',
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined
  });

  db.on('error', (err) => {
    console.error('Checkout DB Pool error:', err);
  });

  const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  app.get('/', async () => ({ name: 'OnceGate Checkout Demo API', status: 'online' }));
  app.get('/healthz', async () => ({ ok: true }));

  const processCharge = async (request: any, reply: any) => {
    if (!dbUrl) return reply.code(500).send({ error: 'DATABASE_URL is missing in environment' });
    const chaos = request.headers['x-chaos'];
    const body = Buffer.isBuffer(request.body)
      ? JSON.parse(request.body.toString('utf8'))
      : request.body as { amount?: number; currency?: string; card_last4?: string };

    if (!body?.amount || !body.currency || !body.card_last4) {
      return reply.code(400).send({ error: 'amount, currency, and card_last4 are required' });
    }

    if (chaos === 'slow') await sleep(15_000);
    if (chaos === 'flaky' && Math.random() < 0.5) return reply.code(500).send({ error: 'injected failure' });

    try {
      await db.query('CREATE SCHEMA IF NOT EXISTS demo;');
      await db.query('CREATE TABLE IF NOT EXISTS demo.charges (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount integer NOT NULL, currency text NOT NULL, card_last4 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());');
      const charge = await db.query<{ id: string }>(
        'INSERT INTO demo.charges (amount,currency,card_last4) VALUES ($1,$2,$3) RETURNING id',
        [body.amount, body.currency, body.card_last4]
      );

      if (chaos === 'die' && !process.env.VERCEL) {
        process.exit(1);
      }

      if (chaos === 'drop') {
        // Execute charge in DB, but drop raw TCP socket connection before sending HTTP response headers
        request.raw.destroy();
        return;
      }

      return reply.code(201).send({ charge_id: charge.rows[0].id });
    } catch (err) {
      app.log.error(err, 'Failed to insert charge');
      return reply.code(500).send({ error: 'Database charge execution failed', message: err instanceof Error ? err.message : String(err) });
    }
  };

  app.post('/charge', processCharge);
  app.post('/direct-charge', processCharge);

  app.get('/charges/count', async (_request, reply) => {
    try {
      const res = await db.query<{ count: string }>('SELECT count(*) FROM demo.charges');
      return { count: Number(res.rows[0].count) };
    } catch {
      return { count: 0 };
    }
  });

  app.delete('/charges', async () => {
    try {
      await db.query('DELETE FROM demo.charges');
    } catch {}
    return { ok: true };
  });

  app.addHook('onClose', async () => { if (!options.db) await db.end(); });

  return app;
}

if (!process.env.VERCEL && process.argv[1]?.endsWith('server.js')) {
  const app = buildCheckoutApp();
  app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3100) }).catch((error) => { app.log.error(error); process.exit(1); });
}
