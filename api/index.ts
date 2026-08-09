import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildCheckoutApp } from '../apps/checkout/src/server.js';
import { buildServer as buildGateServer } from '../apps/gate/src/server.js';
import { loadConfig } from '../apps/gate/src/config.js';

let gateApp: ReturnType<typeof buildGateServer> | null = null;
let checkoutApp: ReturnType<typeof buildCheckoutApp> | null = null;

function getApps() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
  const upstreamUrl = process.env.UPSTREAM_BASE_URL || 'https://httpbin.org';
  const adminToken = process.env.ADMIN_TOKEN || 'admin-secret';

  if (!gateApp) {
    const config = loadConfig({
      ...process.env,
      DATABASE_URL: dbUrl || 'postgres://localhost:5432/oncegate_test',
      UPSTREAM_BASE_URL: upstreamUrl,
      ADMIN_TOKEN: adminToken
    });
    gateApp = buildGateServer({ config });
  }

  if (!checkoutApp) {
    checkoutApp = buildCheckoutApp({ databaseUrl: dbUrl });
  }

  return { gateApp, checkoutApp };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { gateApp, checkoutApp } = getApps();
    await Promise.all([gateApp.ready(), checkoutApp.ready()]);

    const url = req.url || '/';
    const isCheckout = url.startsWith('/charge') || url.startsWith('/charges');
    const targetApp = isCheckout ? checkoutApp : gateApp;

    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      targetApp.server.emit('request', req, res);
    });
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
    }
    res.end(JSON.stringify({
      ok: false,
      error: 'OnceGate Vercel Gateway Error',
      message: error instanceof Error ? error.message : String(error),
      help: 'Ensure DATABASE_URL or POSTGRES_URL is configured in Vercel Environment Variables.'
    }, null, 2));
  }
}
