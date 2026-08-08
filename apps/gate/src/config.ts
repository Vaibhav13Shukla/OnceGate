export interface Config {
  databaseUrl: string;
  upstreamBaseUrl: string;
  upstreamTimeoutMs: number;
  keyTtlHours: number;
  requireKey: boolean;
  adminToken: string;
  responseBodyMaxBytes: number;
  corsOrigin: string | boolean;
}

const boolean = (value: string | undefined) => value === 'true';
const number = (value: string | undefined, fallback: number) => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid positive number: ${value}`);
  return parsed;
};

export function loadConfig(env = process.env): Config {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!env.UPSTREAM_BASE_URL) throw new Error('UPSTREAM_BASE_URL is required');
  return {
    databaseUrl: env.DATABASE_URL,
    upstreamBaseUrl: env.UPSTREAM_BASE_URL.replace(/\/$/, ''),
    upstreamTimeoutMs: number(env.UPSTREAM_TIMEOUT_MS, 10_000),
    keyTtlHours: number(env.KEY_TTL_HOURS, 24),
    requireKey: boolean(env.REQUIRE_KEY),
    adminToken: env.ADMIN_TOKEN ?? '',
    responseBodyMaxBytes: number(env.RESPONSE_BODY_MAX_BYTES, 262_144),
    corsOrigin: env.CORS_ORIGIN ?? false
  };
}
