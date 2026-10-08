import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Order } from '../api/orders';
import { makeOrder, makeRestaurant, mockApi, ordersByStatus } from '../test/api';
import { FakeWebSocket } from '../test/fakeWebSocket';
import { renderWithProviders, signInAsOwner } from '../test/utils';

const ORDER_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

/** A board column, once the page has loaded. */
async function column(name: string) {
  return within(await screen.findByRole('region', { name }));
}

describe('Orders board', () => {
  it('shows paid orders in the New column with their items', async () => {
    signInAsOwner();
    mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'get /owner/orders': ordersByStatus(() => [makeOrder()]),
    });
    renderWithProviders(<App />, { route: '/orders' });

    const card = await (await column('New')).findByRole('article', { name: 'Order #a1b2c3' });
    expect(within(card).getByText('Margherita Pizza')).toBeInTheDocument();
    expect(within(card).getByText('29.50')).toBeInTheDocument();
    expect((await column('Preparing')).getByText('Nothing being prepared.')).toBeInTheDocument();
  });

  it('accepts an order, moving it to Preparing', async () => {
    signInAsOwner();
    let order: Order = makeOrder();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'get /owner/orders': ordersByStatus(() => [order]),
      [`post /owner/orders/${ORDER_ID}/accept`]: () => {
        order = makeOrder({ status: 'PREPARING' });
        return order;
      },
    });
    renderWithProviders(<App />, { route: '/orders' });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Accept' }));

    expect(api.post).toHaveBeenCalledWith(`/owner/orders/${ORDER_ID}/accept`);
    expect(await (await column('Preparing')).findByRole('article', { name: 'Order #a1b2c3' })).toBeInTheDocument();
    expect((await column('Preparing')).getByRole('button', { name: 'Mark ready' })).toBeInTheDocument();
  });

  it('rejects an order with a reason for the customer', async () => {
    signInAsOwner();
    let order: Order = makeOrder();
    const api = mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'get /owner/orders': ordersByStatus(() => [order]),
      [`post /owner/orders/${ORDER_ID}/reject`]: () => {
        order = makeOrder({ status: 'CANCELLED' });
        return order;
      },
    });
    renderWithProviders(<App />, { route: '/orders' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    await user.type(screen.getByLabelText('Reason for the customer (optional)'), 'Out of mozzarella');
    await user.click(screen.getByRole('button', { name: 'Reject and refund' }));

    expect(api.post).toHaveBeenCalledWith(`/owner/orders/${ORDER_ID}/reject`, { reason: 'Out of mozzarella' });
    const history = within(await screen.findByRole('region', { name: 'Recent orders' }));
    expect(await history.findByText('Cancelled')).toBeInTheDocument();
    expect((await column('New')).getByText('No new orders.')).toBeInTheDocument();
  });

  it('shows why an action failed, e.g. when the customer just cancelled', async () => {
    signInAsOwner();
    mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'get /owner/orders': ordersByStatus(() => [makeOrder()]),
      [`post /owner/orders/${ORDER_ID}/accept`]: () => {
        throw Object.assign(new Error('Conflict'), {
          isAxiosError: true,
          response: { status: 409, data: { error: 'Order cannot be accepted while CANCELLED' } },
        });
      },
    });
    renderWithProviders(<App />, { route: '/orders' });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('Order cannot be accepted while CANCELLED')).toBeInTheDocument();
  });

  it('shows a new order as soon as it is pushed, with a toast', async () => {
    signInAsOwner();
    let orders: Order[] = [];
    mockApi({
      'get /owner/restaurants': [makeRestaurant()],
      'get /owner/orders': ordersByStatus(() => orders),
    });
    renderWithProviders(<App />, { route: '/orders' });
    expect(await (await column('New')).findByText('No new orders.')).toBeInTheDocument();

    orders = [makeOrder()];
    const socket = FakeWebSocket.latest();
    socket.open();
    socket.push({ type: 'restaurant.order_updated', orderId: ORDER_ID, restaurantId: 'restaurant-1', status: 'CONFIRMED' });

    expect(await (await column('New')).findByRole('article', { name: 'Order #a1b2c3' })).toBeInTheDocument();
    expect(screen.getByText('New order #a1b2c3 received.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
  });

  it('warns when the restaurant is closed', async () => {
    signInAsOwner();
    mockApi({
      'get /owner/restaurants': [makeRestaurant({ isOpen: false })],
      'get /owner/orders': [],
    });
    renderWithProviders(<App />, { route: '/orders' });

    expect(await screen.findByText(/is closed, so customers can't place new orders/)).toBeInTheDocument();
  });
});
