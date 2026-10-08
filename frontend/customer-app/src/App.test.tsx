import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AUTH_TOKEN_KEY } from './lib/token';
import { FakeWebSocket } from './test/fakeWebSocket';
import { mockGet } from './test/api';
import { CUSTOMER_EMAIL, renderWithProviders, signInAsCustomer } from './test/utils';

describe('App', () => {
  it('sends signed-out visitors to the login page', () => {
    renderWithProviders(<App />, { route: '/orders' });
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('does not open the notification socket while signed out', () => {
    renderWithProviders(<App />, { route: '/login' });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("shows the signed-in customer's email and opens their notification socket", async () => {
    signInAsCustomer();
    mockGet({ '/orders': [], '/restaurants': [] });
    renderWithProviders(<App />, { route: '/orders' });

    expect(await screen.findByText("You haven't placed any orders yet.")).toBeInTheDocument();
    expect(screen.getByText(CUSTOMER_EMAIL)).toBeInTheDocument();
    // The gateway authenticates the socket with the token in its URL.
    expect(FakeWebSocket.latest().url).toMatch(/\/ws\/notifications\?token=.+/);
  });

  it('logs out back to the login page and closes the socket', async () => {
    signInAsCustomer();
    mockGet({ '/orders': [], '/restaurants': [] });
    renderWithProviders(<App />, { route: '/orders' });
    const socket = FakeWebSocket.latest();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(socket.closed).toBe(true);
  });
});
