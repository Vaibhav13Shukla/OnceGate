import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildServer } from '../apps/gate/src/server.js';
import { loadConfig } from '../apps/gate/src/config.js';

let appInstance: ReturnType<typeof buildServer> | null = null;
let initError: Error | null = null;

function getApp() {
  if (initError) throw initError;
  if (!appInstance) {
    try {
      const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
      const upstreamUrl = process.env.UPSTREAM_BASE_URL || 'https://httpbin.org';
      const adminToken = process.env.ADMIN_TOKEN || 'admin-secret';

      if (!dbUrl) {
        throw new Error('DATABASE_URL or POSTGRES_URL is missing. Please set your PostgreSQL/Supabase connection string in Vercel Environment Variables.');
      }

      const env = {
        ...process.env,
        DATABASE_URL: dbUrl,
        UPSTREAM_BASE_URL: upstreamUrl,
        ADMIN_TOKEN: adminToken
      };

      const config = loadConfig(env);
      appInstance = buildServer({ config });
    } catch (err) {
      initError = err instanceof Error ? err : new Error(String(err));
      throw initError;
    }
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = getApp();
    await app.ready();
    app.server.emit('request', req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: 'OnceGate Vercel Serverless Gateway Error',
      message: error instanceof Error ? error.message : String(error),
      help: 'Ensure DATABASE_URL or POSTGRES_URL is configured in Vercel Project Settings.'
    }, null, 2));
  }
}
