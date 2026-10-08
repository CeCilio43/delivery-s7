import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { makeRestaurant, mockApi } from '../test/api';
import { renderWithProviders, signInAsOwner } from '../test/utils';

describe('Registering a restaurant', () => {
  it('sends an owner without a restaurant to set one up, then to its menu', async () => {
    signInAsOwner();
    const created = makeRestaurant({ id: 'restaurant-2', name: 'Pasta Corner', isOpen: false, menuItems: [] });
    const api = mockApi({
      'get /owner/restaurants': [],
      'post /owner/restaurants': created,
    });
    renderWithProviders(<App />, { route: '/orders' });
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Set up your restaurant' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Pasta Corner');
    await user.type(screen.getByLabelText('Address'), '3 Canal Road');
    await user.click(screen.getByRole('button', { name: 'Create restaurant' }));

    expect(api.post).toHaveBeenCalledWith('/owner/restaurants', {
      name: 'Pasta Corner',
      address: '3 Canal Road',
      cuisine: null,
      description: null,
    });
    expect(await screen.findByRole('heading', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByText(/Your menu is empty/)).toBeInTheDocument();
    // New restaurants start closed.
    expect(screen.getByRole('switch', { name: 'Closed for orders' })).toBeInTheDocument();
  });

  it('lets an owner switch between restaurants', async () => {
    signInAsOwner();
    mockApi({
      'get /owner/restaurants': [
        makeRestaurant(),
        makeRestaurant({ id: 'restaurant-2', name: 'Pasta Corner', menuItems: [] }),
      ],
    });
    renderWithProviders(<App />, { route: '/menu' });

    expect(await screen.findByRole('listitem', { name: 'Margherita Pizza' })).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Restaurant' }), 'Pasta Corner');

    expect(await screen.findByText(/Your menu is empty/)).toBeInTheDocument();
  });
});
