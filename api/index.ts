import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Load compiled gate server from dist/ if present, otherwise fall back to src/
let buildServer: typeof import('../apps/gate/src/server.js').buildServer;
let loadConfig: typeof import('../apps/gate/src/config.js').loadConfig;

try {
  const distServerPath = '../apps/gate/dist/server.js';
  const distConfigPath = '../apps/gate/dist/config.js';
  const gateDistMod = await import(distServerPath);
  const gateConfigMod = await import(distConfigPath);
  buildServer = gateDistMod.buildServer;
  loadConfig = gateConfigMod.loadConfig;
} catch {
  const gateSrcMod = await import('../apps/gate/src/server.js');
  const gateConfigMod = await import('../apps/gate/src/config.js');
  buildServer = gateSrcMod.buildServer;
  loadConfig = gateConfigMod.loadConfig;
}

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
    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      app.server.emit('request', req, res);
    });
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
    }
    res.end(JSON.stringify({
      ok: false,
      error: 'OnceGate Vercel Serverless Gateway Error',
      message: error instanceof Error ? error.message : String(error),
      help: 'Ensure DATABASE_URL or POSTGRES_URL is configured in Vercel Project Settings.'
    }, null, 2));
  }
}
