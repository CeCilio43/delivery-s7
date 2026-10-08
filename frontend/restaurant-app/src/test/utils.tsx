import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { RestaurantProvider } from '../context/RestaurantContext';
import { AUTH_TOKEN_KEY, type Role } from '../lib/token';

export const OWNER_EMAIL = 'sam@mariospizzeria.com';

/**
 * Builds an unsigned JWT with the given claims. The app only decodes tokens
 * (the gateway verifies signatures), so this is enough to drive its auth.
 */
export function makeToken(
  claims: { sub?: string; role?: Role; email?: string; exp?: number } = {},
): string {
  const payload = {
    sub: 'owner-1',
    role: 'RESTAURANT_OWNER',
    email: OWNER_EMAIL,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

/** Stores a valid owner token, as if they had logged in earlier. */
export function signInAsOwner() {
  localStorage.setItem(AUTH_TOKEN_KEY, makeToken());
}

/** Renders `ui` inside all of the app's providers, starting at `route`. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <RestaurantProvider>
          <NotificationProvider>{ui}</NotificationProvider>
        </RestaurantProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
