import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import App from '../App';
import { apiClient } from '../api/client';
import type { Order } from '../api/orders';
import type { Payment } from '../api/payments';
import { makeOrder, mockGet, restaurant } from '../test/api';
import { FakeWebSocket } from '../test/fakeWebSocket';
import { renderWithProviders, signInAsCustomer } from '../test/utils';

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    orderId: 'order-1',
    amount: '29.5',
    status: 'PENDING',
    createdAt: '2026-10-08T12:00:00.000Z',
    ...overrides,
  };
}

describe('Order page', () => {
  it('shows the order with its items and status', async () => {
    signInAsCustomer();
    mockGet({
      '/orders/order-1': makeOrder(),
      '/restaurants/restaurant-1': restaurant,
      '/payments': [makePayment()],
    });
    renderWithProviders(<App />, { route: '/orders/order-1' });

    expect(await screen.findByText('Your order is waiting for payment.')).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.getByText('2 × Margherita Pizza')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: "Mario's Pizzeria" })).toBeInTheDocument();
  });

  it('refreshes as soon as an order update is pushed over the websocket', async () => {
    signInAsCustomer();
    let order: Order = makeOrder({ status: 'PLACED' });
    mockGet({
      '/orders/order-1': () => order,
      '/restaurants/restaurant-1': restaurant,
      '/payments': [makePayment({ status: 'SUCCEEDED' })],
    });
    renderWithProviders(<App />, { route: '/orders/order-1' });
    expect(await screen.findByText('Payment received. Confirming your order…')).toBeInTheDocument();

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

  it('pays a placed order with "Pay now"', async () => {
    signInAsCustomer();
    let payment = makePayment();
    mockGet({
      '/orders/order-1': makeOrder(),
      '/restaurants/restaurant-1': restaurant,
      '/payments': () => [payment],
    });
    const post = vi.spyOn(apiClient, 'post').mockImplementationOnce(async () => {
      payment = makePayment({ status: 'SUCCEEDED' });
      return { data: payment };
    });
    renderWithProviders(<App />, { route: '/orders/order-1' });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Pay now · 29.50' }));

    expect(post).toHaveBeenCalledWith('/payments/pay-1/pay');
    expect(await screen.findByText('Payment received. Confirming your order…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay now/ })).not.toBeInTheDocument();
  });

  it('shows why paying failed and lets the customer try again', async () => {
    signInAsCustomer();
    mockGet({
      '/orders/order-1': makeOrder(),
      '/restaurants/restaurant-1': restaurant,
      '/payments': [makePayment()],
    });
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(
      new AxiosError('Service Unavailable', '503', undefined, undefined, {
        status: 503,
        statusText: 'Service Unavailable',
        data: { error: 'Could not process the payment right now; please try again' },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithProviders(<App />, { route: '/orders/order-1' });

    await userEvent.setup().click(await screen.findByRole('button', { name: /Pay now/ }));

    expect(
      await screen.findByText('Could not process the payment right now; please try again'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay now/ })).toBeEnabled();
  });

  it('waits for the payment before offering "Pay now"', async () => {
    signInAsCustomer();
    mockGet({ '/orders/order-1': makeOrder(), '/restaurants/restaurant-1': restaurant, '/payments': [] });
    renderWithProviders(<App />, { route: '/orders/order-1' });

    expect(await screen.findByText('Getting your payment ready…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay now/ })).not.toBeInTheDocument();
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
