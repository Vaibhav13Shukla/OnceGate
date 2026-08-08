import { createHash } from 'node:crypto';

export function fingerprint(method: string, normalizedPath: string, body: Buffer): string {
  return createHash('sha256').update(method).update('\n').update(normalizedPath).update('\n').update(body).digest('hex');
}
