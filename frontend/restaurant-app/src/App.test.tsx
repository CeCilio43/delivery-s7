import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AUTH_TOKEN_KEY } from './lib/token';
import { makeToken, renderWithProviders } from './test/utils';

describe('routing', () => {
  it('sends signed-out visitors to the login page', () => {
    renderWithProviders(<App />, { route: '/orders' });
    expect(screen.getByRole('heading', { name: 'Restaurant sign in' })).toBeInTheDocument();
  });

  it('does not let a customer token in', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, makeToken({ role: 'CUSTOMER' }));
    renderWithProviders(<App />, { route: '/orders' });
    expect(screen.getByRole('heading', { name: 'Restaurant sign in' })).toBeInTheDocument();
  });

  it('shows a signed-in owner the orders page with their email', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, makeToken({ email: 'sam@mariospizzeria.com' }));
    renderWithProviders(<App />, { route: '/orders' });

    expect(screen.getByRole('heading', { name: 'Incoming orders' })).toBeInTheDocument();
    expect(screen.getByText('sam@mariospizzeria.com')).toBeInTheDocument();
  });

  it('logs out back to the login page', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, makeToken());
    renderWithProviders(<App />, { route: '/orders' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));

    expect(screen.getByRole('heading', { name: 'Restaurant sign in' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });
});
