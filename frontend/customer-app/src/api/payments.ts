import { apiClient } from './client';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

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
