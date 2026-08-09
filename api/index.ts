import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildServer } from '../apps/gate/dist/server.js';
import { loadConfig } from '../apps/gate/dist/config.js';

let appInstance: ReturnType<typeof buildServer> | null = null;

async function getApp() {
  if (!appInstance) {
    const env = {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://postgres:admin@localhost:5432/oncegate',
      UPSTREAM_BASE_URL: process.env.UPSTREAM_BASE_URL || 'http://localhost:3100',
      ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'admin-secret'
    };
    const config = loadConfig(env);
    appInstance = buildServer({ config });
    await appInstance.ready();
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      error: 'Vercel Serverless Gateway Initialization Error',
      detail: error instanceof Error ? error.message : String(error)
    }));
  }
}
