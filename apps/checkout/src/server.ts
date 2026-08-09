import Fastify from 'fastify';
import pg from 'pg';

const app = Fastify({ logger: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
app.post('/charge', async (request, reply) => {
  const chaos = request.headers['x-chaos'];
  const body = request.body as { amount?: number; currency?: string; card_last4?: string };
  if (!body?.amount || !body.currency || !body.card_last4) return reply.code(400).send({ error: 'amount, currency, and card_last4 are required' });
  if (chaos === 'slow') await sleep(15_000);
  if (chaos === 'flaky' && Math.random() < 0.5) return reply.code(500).send({ error: 'injected failure' });
  const charge = await db.query<{ id: string }>('INSERT INTO demo.charges (amount,currency,card_last4) VALUES ($1,$2,$3) RETURNING id', [body.amount, body.currency, body.card_last4]);
  if (chaos === 'die') { reply.raw.flushHeaders(); process.exit(1); }
  return reply.code(201).send({ charge_id: charge.rows[0].id });
});
app.get('/charges/count', async () => ({ count: Number((await db.query<{ count: string }>('SELECT count(*) FROM demo.charges')).rows[0].count) }));
app.delete('/charges', async () => { await db.query('DELETE FROM demo.charges'); return { ok: true }; });
app.get('/healthz', async () => ({ ok: true }));
app.addHook('onClose', async () => db.end());

if (!process.env.VERCEL && process.argv[1]?.endsWith('server.js')) app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3100) }).catch((error) => { app.log.error(error); process.exit(1); });

export { app };
