import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { apiClient } from '../api/client';
import type { Payment } from '../api/payments';
import { makeOrder, mockGet, restaurant } from '../test/api';
import { renderWithProviders, signInAsCustomer } from '../test/utils';

describe('My orders page', () => {
  it('lets an unpaid order be paid straight from the list', async () => {
    signInAsCustomer();
    let payment: Payment = {
      id: 'pay-1',
      orderId: 'order-1',
      amount: '29.5',
      status: 'PENDING',
      createdAt: '2026-10-08T12:00:00.000Z',
    };
    mockGet({
      '/orders': [makeOrder(), makeOrder({ id: 'order-2', status: 'CONFIRMED' })],
      '/restaurants': [restaurant],
      '/payments': () => [payment],
    });
    const post = vi.spyOn(apiClient, 'post').mockImplementationOnce(async () => {
      payment = { ...payment, status: 'SUCCEEDED' };
      return { data: payment };
    });
    renderWithProviders(<App />, { route: '/orders' });

    // Only the unpaid order offers to pay.
    const payButtons = await screen.findAllByRole('button', { name: 'Pay now · 29.50' });
    expect(payButtons).toHaveLength(1);

    await userEvent.setup().click(payButtons[0]);

    expect(post).toHaveBeenCalledWith('/payments/pay-1/pay');
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: /Pay now/ })).not.toBeInTheDocument(),
    );
    expect(within(screen.getAllByRole('link', { name: /Mario's Pizzeria/ })[0]).getByText('Awaiting payment')).toBeInTheDocument();
  });
});
