import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildServer } from '../apps/gate/src/server.js';
import { loadConfig } from '../apps/gate/src/config.js';

let appInstance: ReturnType<typeof buildServer> | null = null;

function getApp() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
  const upstreamUrl = process.env.UPSTREAM_BASE_URL || 'https://httpbin.org';
  const adminToken = process.env.ADMIN_TOKEN || 'admin-secret';

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is missing. Please set DATABASE_URL or POSTGRES_URL in Vercel Project Settings -> Environment Variables.');
  }

  if (!appInstance) {
    const env = {
      ...process.env,
      DATABASE_URL: dbUrl,
      UPSTREAM_BASE_URL: upstreamUrl,
      ADMIN_TOKEN: adminToken
    };

    const config = loadConfig(env);
    appInstance = buildServer({ config });
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = getApp();
    await app.ready();

    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      app.server.emit('request', req, res);
    });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
    }

    res.end(JSON.stringify({
      ok: false,
      error: 'OnceGate Vercel Gateway Error',
      message: errMessage,
      stack: process.env.NODE_ENV === 'development' ? errStack : undefined,
      help: 'Ensure DATABASE_URL or POSTGRES_URL is configured in Vercel Project Settings -> Environment Variables.'
    }, null, 2));
  }
}
