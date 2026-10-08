import { describe, expect, it } from 'vitest';
import { decodeToken } from './token';
import { makeToken } from '../test/utils';

describe('decodeToken', () => {
  it('returns the claims of a valid token', () => {
    expect(decodeToken(makeToken({ sub: 'customer-1', email: 'jamie@example.com' }))).toMatchObject({
      sub: 'customer-1',
      role: 'CUSTOMER',
      email: 'jamie@example.com',
    });
  });

  it('returns null for an expired token', () => {
    expect(decodeToken(makeToken({ exp: Math.floor(Date.now() / 1000) - 60 }))).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(decodeToken('not-a-jwt')).toBeNull();
  });
});
