import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider, type Cart } from '../context/CartContext';
import { NotificationProvider } from '../context/NotificationContext';
import { AUTH_TOKEN_KEY, type Role } from '../lib/token';

export const CUSTOMER_ID = 'customer-1';
export const CUSTOMER_EMAIL = 'jamie@example.com';

/**
 * Builds an unsigned JWT with the given claims. The app only decodes tokens
 * (the gateway verifies signatures), so this is enough to drive its auth.
 */
export function makeToken(
  claims: { sub?: string; role?: Role; email?: string; exp?: number } = {},
): string {
  const payload = {
    sub: CUSTOMER_ID,
    role: 'CUSTOMER',
    email: CUSTOMER_EMAIL,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

/** Stores a valid customer token, as if they had logged in earlier. */
export function signInAsCustomer() {
  localStorage.setItem(AUTH_TOKEN_KEY, makeToken());
}

/** Stores a cart for the signed-in customer, as CartContext would. */
export function storeCart(cart: Cart) {
  localStorage.setItem(`cart:${CUSTOMER_ID}`, JSON.stringify(cart));
}

/** Renders `ui` inside all of the app's providers, starting at `route`. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <CartProvider>
          <NotificationProvider>{ui}</NotificationProvider>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
