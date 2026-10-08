import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import type { Role } from '../lib/token';

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
    email: 'sam@mariospizzeria.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

/** Renders `ui` inside the app's providers, starting at `route`. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}
