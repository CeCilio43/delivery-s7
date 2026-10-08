import { describe, expect, it } from 'vitest';
import { decodeToken, userFromToken } from './token';
import { makeToken } from '../test/utils';

describe('decodeToken', () => {
  it('returns the claims of a valid token', () => {
    const payload = decodeToken(makeToken({ sub: 'owner-1', email: 'sam@mariospizzeria.com' }));
    expect(payload).toMatchObject({
      sub: 'owner-1',
      role: 'RESTAURANT_OWNER',
      email: 'sam@mariospizzeria.com',
    });
  });

  it('returns null for an expired token', () => {
    const expired = makeToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(decodeToken(expired)).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(decodeToken('not-a-jwt')).toBeNull();
  });
});

describe('userFromToken', () => {
  it('signs in a restaurant owner', () => {
    expect(userFromToken(makeToken({ sub: 'owner-1', email: 'sam@mariospizzeria.com' }))).toEqual({
      id: 'owner-1',
      role: 'RESTAURANT_OWNER',
      email: 'sam@mariospizzeria.com',
    });
  });

  it('treats a customer token as signed out', () => {
    expect(userFromToken(makeToken({ role: 'CUSTOMER' }))).toBeNull();
  });

  it('treats a missing token as signed out', () => {
    expect(userFromToken(null)).toBeNull();
  });
});
