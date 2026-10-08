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
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
}

export interface PlaceOrderInput {
  restaurantId: string;
  items: { menuItemId: string; quantity: number }[];
}

// Only ids and quantities are sent; order-service looks up the real prices
// from restaurant-service, so the total it returns is the one that counts.
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const { data } = await apiClient.post<Order>('/orders', input);
  return data;
}

export async function getOrders(): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>('/orders');
  return data;
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/orders/${id}`);
  return data;
}

export async function cancelOrder(id: string): Promise<Order> {
  const { data } = await apiClient.post<Order>(`/orders/${id}/cancel`);
  return data;
}

// Payment is settled asynchronously over the event bus after an order is
// placed, so a PLACED order is still waiting for its outcome.
export function isAwaitingPayment(order: Order): boolean {
  return order.status === 'PLACED';
}

export function isCancellable(order: Order): boolean {
  return order.status === 'PLACED' || order.status === 'CONFIRMED';
}
