import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AUTH_TOKEN_KEY } from './lib/token';
import { makeRestaurant, mockApi } from './test/api';
import { FakeWebSocket } from './test/fakeWebSocket';
import { makeToken, OWNER_EMAIL, renderWithProviders, signInAsOwner } from './test/utils';

function mockSignedInApi() {
  mockApi({ 'get /owner/restaurants': [makeRestaurant()], 'get /owner/orders': [] });
}

describe('routing', () => {
  it('sends signed-out visitors to the login page', () => {
    renderWithProviders(<App />, { route: '/orders' });
    expect(screen.getByRole('heading', { name: 'Restaurant sign in' })).toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('does not let a customer token in', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, makeToken({ role: 'CUSTOMER' }));
    renderWithProviders(<App />, { route: '/orders' });
    expect(screen.getByRole('heading', { name: 'Restaurant sign in' })).toBeInTheDocument();
  });

  it("shows a signed-in owner their restaurant's orders and opens their notification socket", async () => {
    signInAsOwner();
    mockSignedInApi();
    renderWithProviders(<App />, { route: '/orders' });

    expect(await screen.findByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(await screen.findByText("Mario's Pizzeria")).toBeInTheDocument();
    expect(screen.getByText(OWNER_EMAIL)).toBeInTheDocument();
    expect(FakeWebSocket.latest().url).toMatch(/\/ws\/notifications\?token=.+/);
  });

  it('logs out back to the login page and closes the socket', async () => {
    signInAsOwner();
    mockSignedInApi();
    renderWithProviders(<App />, { route: '/orders' });
    const socket = FakeWebSocket.latest();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log out' }));

    expect(screen.getByRole('heading', { name: 'Restaurant sign in' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(socket.closed).toBe(true);
  });
});
