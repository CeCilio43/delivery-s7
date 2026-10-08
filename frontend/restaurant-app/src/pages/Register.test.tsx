import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { AUTH_TOKEN_KEY } from '../lib/token';
import { mockApi } from '../test/api';
import { makeToken, renderWithProviders } from '../test/utils';

async function fillIn(fields: { name?: string; email?: string; password?: string; confirm?: string }) {
  const user = userEvent.setup();
  if (fields.name) await user.type(screen.getByLabelText('Your name (optional)'), fields.name);
  if (fields.email) await user.type(screen.getByLabelText('Email'), fields.email);
  if (fields.password) await user.type(screen.getByLabelText('Password'), fields.password);
  if (fields.confirm) await user.type(screen.getByLabelText('Confirm password'), fields.confirm);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('Register', () => {
  it('is reachable from the login screen', async () => {
    renderWithProviders(<App />, { route: '/login' });

    await userEvent.setup().click(screen.getByRole('link', { name: 'Create an account' }));

    expect(screen.getByRole('heading', { name: 'Create a restaurant account' })).toBeInTheDocument();
  });

  it('signs up a restaurant owner and starts restaurant setup', async () => {
    const api = mockApi({
      'post /register/restaurant-owner': {
        token: makeToken({ sub: 'owner-9', email: 'chef@pastacorner.com' }),
        user: { id: 'owner-9', email: 'chef@pastacorner.com', role: 'RESTAURANT_OWNER' },
      },
      // A brand-new owner has no restaurants yet.
      'get /owner/restaurants': [],
    });
    renderWithProviders(<App />, { route: '/register' });

    await fillIn({ name: 'Chef', email: 'chef@pastacorner.com', password: 'secret123', confirm: 'secret123' });

    expect(api.post).toHaveBeenCalledWith('/register/restaurant-owner', {
      email: 'chef@pastacorner.com',
      password: 'secret123',
      name: 'Chef',
    });
    expect(await screen.findByRole('heading', { name: 'Set up your restaurant' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).not.toBeNull();
  });

  it('validates the form before calling the API', async () => {
    const api = mockApi({});
    renderWithProviders(<App />, { route: '/register' });

    await fillIn({ email: 'chef@pastacorner.com', password: 'short', confirm: 'different' });

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows the server's error, e.g. for an email that's taken", async () => {
    mockApi({
      'post /register/restaurant-owner': () => {
        throw Object.assign(new Error('Conflict'), {
          isAxiosError: true,
          response: { status: 409, data: { error: 'A user with that email already exists' } },
        });
      },
    });
    renderWithProviders(<App />, { route: '/register' });

    await fillIn({ email: 'sam@mariospizzeria.com', password: 'secret123', confirm: 'secret123' });

    expect(await screen.findByRole('alert')).toHaveTextContent('A user with that email already exists');
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });
});
