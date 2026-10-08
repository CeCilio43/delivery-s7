import { apiClient } from './client';

// CANCELLED: never paid, because the order was cancelled first.
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export interface Payment {
  id: string;
  orderId: string;
  amount: string;
  status: PaymentStatus;
  createdAt: string;
}

export async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
  const { data } = await apiClient.get<Payment[]>('/payments', { params: { orderId } });
  return data;
}

// Mock "Pay now": payment-service charges the pending payment with its
// simulated provider (which declines totals above 100) and tells
// order-service the outcome over the event bus.
export async function payPayment(id: string): Promise<Payment> {
  const { data } = await apiClient.post<Payment>(`/payments/${id}/pay`);
  return data;
}
