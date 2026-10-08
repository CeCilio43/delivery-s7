import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { makeRestaurant, mockApi } from '../test/api';
import { renderWithProviders, signInAsOwner } from '../test/utils';

const pizza = makeRestaurant().menuItems[0]!;

describe('Menu', () => {
  it('lists the menu', async () => {
    signInAsOwner();
    mockApi({ 'get /owner/restaurants': [makeRestaurant()] });
    renderWithProviders(<App />, { route: '/menu' });

    const row = within(await screen.findByRole('listitem', { name: 'Margherita Pizza' }));
    expect(row.getByText('12.50')).toBeInTheDocument();
    expect(row.getByText('Tomato, mozzarella, basil')).toBeInTheDocument();
  });

  it('adds an item', async () => {
    signInAsOwner();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'post /owner/restaurants/restaurant-1/menu-items': {
        id: 'item-9',
        restaurantId: 'restaurant-1',
        name: 'Calzone',
        description: null,
        price: '13.5',
        isAvailable: true,
      },
    });
    renderWithProviders(<App />, { route: '/menu' });
    const user = userEvent.setup();
    const form = within(await screen.findByRole('region', { name: 'Add a menu item' }));

    await user.type(form.getByLabelText('Name'), 'Calzone');
    await user.type(form.getByLabelText('Price'), '13,50');
    await user.click(form.getByRole('button', { name: 'Add to menu' }));

    expect(api.post).toHaveBeenCalledWith('/owner/restaurants/restaurant-1/menu-items', {
      name: 'Calzone',
      description: null,
      price: 13.5,
    });
    expect(await screen.findByRole('listitem', { name: 'Calzone' })).toBeInTheDocument();
    expect(form.getByLabelText('Name')).toHaveValue('');
  });

  it('checks the price before sending', async () => {
    signInAsOwner();
    const api = mockApi({ 'get /owner/restaurants': [makeRestaurant()] });
    renderWithProviders(<App />, { route: '/menu' });
    const user = userEvent.setup();
    const form = within(await screen.findByRole('region', { name: 'Add a menu item' }));

    await user.type(form.getByLabelText('Name'), 'Calzone');
    await user.type(form.getByLabelText('Price'), '12.345');
    await user.click(form.getByRole('button', { name: 'Add to menu' }));

    expect(form.getByRole('alert')).toHaveTextContent('Enter a price like 12.50');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('marks an item unavailable', async () => {
    signInAsOwner();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'patch /owner/restaurants/restaurant-1/menu-items/item-1': { ...pizza, isAvailable: false },
    });
    renderWithProviders(<App />, { route: '/menu' });

    await userEvent.setup().click(await screen.findByRole('switch', { name: 'Margherita Pizza available' }));

    expect(api.patch).toHaveBeenCalledWith('/owner/restaurants/restaurant-1/menu-items/item-1', {
      isAvailable: false,
    });
    const row = within(screen.getByRole('listitem', { name: 'Margherita Pizza' }));
    expect(await row.findByText('Unavailable')).toBeInTheDocument();
  });

  it('edits an item', async () => {
    signInAsOwner();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'patch /owner/restaurants/restaurant-1/menu-items/item-1': { ...pizza, price: '13' },
    });
    renderWithProviders(<App />, { route: '/menu' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const editing = within(screen.getByRole('listitem', { name: 'Editing Margherita Pizza' }));
    await user.clear(editing.getByLabelText('Price'));
    await user.type(editing.getByLabelText('Price'), '13');
    await user.click(editing.getByRole('button', { name: 'Save' }));

    expect(api.patch).toHaveBeenCalledWith('/owner/restaurants/restaurant-1/menu-items/item-1', {
      name: 'Margherita Pizza',
      description: 'Tomato, mozzarella, basil',
      price: 13,
    });
    expect(await screen.findByText('13.00')).toBeInTheDocument();
  });

  it('deletes an item only after confirming', async () => {
    signInAsOwner();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'delete /owner/restaurants/restaurant-1/menu-items/item-1': null,
    });
    renderWithProviders(<App />, { route: '/menu' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(api.delete).toHaveBeenCalledWith('/owner/restaurants/restaurant-1/menu-items/item-1');
    expect(await screen.findByText(/Your menu is empty/)).toBeInTheDocument();
  });
});
