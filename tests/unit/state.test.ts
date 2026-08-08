import { describe, expect, it } from 'vitest';
import { fingerprint } from '../../apps/gate/src/fingerprint.js';
import { canTransition } from '../../apps/gate/src/state.js';

describe('receipt state machine', () => {
  it('only permits documented state transitions', () => {
    expect(canTransition('PENDING', 'COMMITTED')).toBe(true);
    expect(canTransition('PENDING', 'FAILED')).toBe(true);
    expect(canTransition('PENDING', 'UNKNOWN')).toBe(true);
    expect(canTransition('UNKNOWN', 'COMMITTED')).toBe(true);
    expect(canTransition('COMMITTED', 'PENDING')).toBe(false);
    expect(canTransition('FAILED', 'UNKNOWN')).toBe(false);
  });

  it('binds a fingerprint to method, normalized path, and exact body bytes', () => {
    const base = fingerprint('POST', '/charge', Buffer.from('{"amount":100}'));
    expect(fingerprint('POST', '/charge', Buffer.from('{"amount":100}'))).toBe(base);
    expect(fingerprint('POST', '/charge', Buffer.from('{"amount":101}'))).not.toBe(base);
    expect(fingerprint('PUT', '/charge', Buffer.from('{"amount":100}'))).not.toBe(base);
  });
});
