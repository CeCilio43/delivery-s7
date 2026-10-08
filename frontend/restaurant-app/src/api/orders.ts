import { apiClient } from './client';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderLine {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  status: OrderStatus;
  totalAmount: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
}

/** Statuses the kitchen still has to act on, in board order. */
export const ACTIVE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY'];

/** Paid orders for one of the owner's restaurants, oldest first. */
export async function getRestaurantOrders(
  restaurantId: string,
  statuses?: OrderStatus[],
): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>('/owner/orders', {
    params: { restaurantId, ...(statuses ? { status: statuses.join(',') } : {}) },
  });
  return data;
}

/** CONFIRMED → PREPARING. */
export async function acceptOrder(id: string): Promise<Order> {
  const { data } = await apiClient.post<Order>(`/owner/orders/${id}/accept`);
  return data;
}

/** PREPARING → READY. */
export async function markOrderReady(id: string): Promise<Order> {
  const { data } = await apiClient.post<Order>(`/owner/orders/${id}/ready`);
  return data;
}

/** Cancels the order; payment-service refunds the customer. */
export async function rejectOrder(id: string, reason: string): Promise<Order> {
  const { data } = await apiClient.post<Order>(`/owner/orders/${id}/reject`, {
    ...(reason.trim() ? { reason: reason.trim() } : {}),
  });
  return data;
}
