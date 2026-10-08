import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import App from '../App';
import type { Order } from '../api/orders';
import { makeOrder, mockGet, restaurant } from '../test/api';
import { FakeWebSocket } from '../test/fakeWebSocket';
import { renderWithProviders, signInAsCustomer } from '../test/utils';

describe('Order page', () => {
  it('shows the order with its items and status', async () => {
    signInAsCustomer();
    mockGet({ '/orders/order-1': makeOrder(), '/restaurants/restaurant-1': restaurant });
    renderWithProviders(<App />, { route: '/orders/order-1' });

    expect(await screen.findByText('Processing your payment…')).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.getByText('2 × Margherita Pizza')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: "Mario's Pizzeria" })).toBeInTheDocument();
  });

  it('refreshes as soon as an order update is pushed over the websocket', async () => {
    signInAsCustomer();
    let order: Order = makeOrder({ status: 'PLACED' });
    mockGet({ '/orders/order-1': () => order, '/restaurants/restaurant-1': restaurant });
    renderWithProviders(<App />, { route: '/orders/order-1' });
    expect(await screen.findByText('Processing your payment…')).toBeInTheDocument();

    order = makeOrder({ status: 'CONFIRMED' });
    const socket = FakeWebSocket.latest();
    socket.open();
    socket.push({ type: 'order.updated', orderId: 'order-1', status: 'CONFIRMED' });

    expect(
      await screen.findByText('Payment received. The restaurant has your order.'),
    ).toBeInTheDocument();
    // The push also shows a toast.
    expect(screen.getByText(/Order confirmed/)).toBeInTheDocument();
  });

  it('explains a cancellation caused by a declined payment', async () => {
    signInAsCustomer();
    mockGet({
      '/orders/order-1': makeOrder({ status: 'CANCELLED' }),
      '/restaurants/restaurant-1': restaurant,
      '/payments': [{ id: 'pay-1', orderId: 'order-1', amount: '29.5', status: 'FAILED' }],
    });
    renderWithProviders(<App />, { route: '/orders/order-1' });

    expect(
      await screen.findByText('Your payment was declined, so this order was cancelled.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('follows the restaurant preparing the order and stops offering to cancel', async () => {
    signInAsCustomer();
    let order: Order = makeOrder({ status: 'CONFIRMED' });
    mockGet({ '/orders/order-1': () => order, '/restaurants/restaurant-1': restaurant });
    renderWithProviders(<App />, { route: '/orders/order-1' });
    expect(await screen.findByRole('button', { name: 'Cancel order' })).toBeInTheDocument();

    order = makeOrder({ status: 'PREPARING' });
    const socket = FakeWebSocket.latest();
    socket.open();
    socket.push({ type: 'order.updated', orderId: 'order-1', status: 'PREPARING' });

    expect(await screen.findByText('The restaurant is preparing your order.', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });
});
