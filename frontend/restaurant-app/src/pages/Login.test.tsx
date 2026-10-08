import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import App from '../App';
import { apiClient } from '../api/client';
import { AUTH_TOKEN_KEY } from '../lib/token';
import { makeToken, renderWithProviders } from '../test/utils';

function loginResponse(role: 'RESTAURANT_OWNER' | 'CUSTOMER') {
  const token = makeToken({ role, email: 'sam@mariospizzeria.com' });
  return {
    data: { token, user: { id: 'user-1', email: 'sam@mariospizzeria.com', role } },
  };
}

async function signIn(email = 'sam@mariospizzeria.com', password = 'password123') {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Login', () => {
  it('validates the form before calling the API', async () => {
    const post = vi.spyOn(apiClient, 'post');
    renderWithProviders(<App />, { route: '/login' });

    await signIn('not-an-email', '');

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('signs an owner in and opens the orders page', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(loginResponse('RESTAURANT_OWNER'));
    renderWithProviders(<App />, { route: '/login' });

    await signIn();

    expect(post).toHaveBeenCalledWith('/login', {
      email: 'sam@mariospizzeria.com',
      password: 'password123',
    });
    expect(await screen.findByRole('heading', { name: 'Incoming orders' })).toBeInTheDocument();
    expect(screen.getByText('sam@mariospizzeria.com')).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).not.toBeNull();
  });

  it('refuses accounts that are not restaurant owners', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce(loginResponse('CUSTOMER'));
    renderWithProviders(<App />, { route: '/login' });

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent("isn't a restaurant owner");
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("shows the server's error message", async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Invalid email or password' },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithProviders(<App />, { route: '/login' });

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
