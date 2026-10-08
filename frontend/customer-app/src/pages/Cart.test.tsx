import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import App from '../App';
import { apiClient } from '../api/client';
import { makeOrder, mockGet, restaurant } from '../test/api';
import { CUSTOMER_ID, renderWithProviders, signInAsCustomer, storeCart } from '../test/utils';

function withCart() {
  signInAsCustomer();
  storeCart({
    restaurantId: 'restaurant-1',
    restaurantName: "Mario's Pizzeria",
    items: [
      { menuItemId: 'item-1', name: 'Margherita Pizza', price: '12.50', quantity: 2 },
      { menuItemId: 'item-2', name: 'Garlic Bread', price: '4.50', quantity: 1 },
    ],
  });
}

describe('Cart page', () => {
  it('shows the items and total', () => {
    withCart();
    renderWithProviders(<App />, { route: '/cart' });

    expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
    expect(screen.getByText('Garlic Bread')).toBeInTheDocument();
    expect(screen.getByText('29.50')).toBeInTheDocument();
  });

  it('places the order with ids and quantities only, then opens it', async () => {
    withCart();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: makeOrder() });
    mockGet({
      '/orders/order-1': makeOrder(),
      '/restaurants/restaurant-1': restaurant,
      '/payments': [{ id: 'pay-1', orderId: 'order-1', amount: '29.5', status: 'PENDING', createdAt: '' }],
    });
    renderWithProviders(<App />, { route: '/cart' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Place order' }));

    // Prices are left out on purpose: order-service looks them up itself.
    expect(post).toHaveBeenCalledWith('/orders', {
      restaurantId: 'restaurant-1',
      items: [
        { menuItemId: 'item-1', quantity: 2 },
        { menuItemId: 'item-2', quantity: 1 },
      ],
    });
    expect(await screen.findByRole('button', { name: 'Pay now · 29.50' })).toBeInTheDocument();
    expect(localStorage.getItem(`cart:${CUSTOMER_ID}`)).toBeNull();
  });

  it("shows the server's error and keeps the cart", async () => {
    withCart();
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new AxiosError('Conflict', '409', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        data: { error: 'Restaurant is currently closed' },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithProviders(<App />, { route: '/cart' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByText('Restaurant is currently closed')).toBeInTheDocument();
    expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
  });

  it('shows an empty state without a cart', () => {
    signInAsCustomer();
    renderWithProviders(<App />, { route: '/cart' });
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });
});
