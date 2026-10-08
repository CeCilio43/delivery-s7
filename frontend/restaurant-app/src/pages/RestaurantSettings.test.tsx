import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { makeRestaurant, mockApi } from '../test/api';
import { renderWithProviders, signInAsOwner } from '../test/utils';

describe('Restaurant settings', () => {
  it('saves edited details', async () => {
    signInAsOwner();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'patch /owner/restaurants/restaurant-1': makeRestaurant({ description: 'Wood-fired since 1998' }),
    });
    renderWithProviders(<App />, { route: '/restaurant' });
    const user = userEvent.setup();
    const details = within(await screen.findByRole('region', { name: 'Details' }));

    await user.type(details.getByLabelText('Description (optional)'), 'Wood-fired since 1998');
    await user.click(details.getByRole('button', { name: 'Save changes' }));

    expect(api.patch).toHaveBeenCalledWith('/owner/restaurants/restaurant-1', {
      name: "Mario's Pizzeria",
      address: '12 Market Street',
      cuisine: 'Italian',
      description: 'Wood-fired since 1998',
    });
    expect(await details.findByRole('status')).toHaveTextContent('Saved.');
  });

  it('requires a name', async () => {
    signInAsOwner();
    const api = mockApi({ 'get /owner/restaurants': [makeRestaurant()] });
    renderWithProviders(<App />, { route: '/restaurant' });
    const user = userEvent.setup();
    const details = within(await screen.findByRole('region', { name: 'Details' }));

    await user.clear(details.getByLabelText('Name'));
    await user.click(details.getByRole('button', { name: 'Save changes' }));

    expect(details.getByText('Name is required')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('closes the restaurant from the toggle', async () => {
    signInAsOwner();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'patch /owner/restaurants/restaurant-1': makeRestaurant({ isOpen: false }),
    });
    renderWithProviders(<App />, { route: '/restaurant' });

    // The same toggle sits in the nav and on this page; either works.
    const [toggle] = await screen.findAllByRole('switch', { name: 'Open for orders' });
    await userEvent.setup().click(toggle!);

    expect(api.patch).toHaveBeenCalledWith('/owner/restaurants/restaurant-1', { isOpen: false });
    expect((await screen.findAllByRole('switch', { name: 'Closed for orders' })).length).toBeGreaterThan(0);
  });
});
