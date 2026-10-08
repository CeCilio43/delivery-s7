import { vi } from 'vitest';
import { apiClient } from '../api/client';
import type { Order } from '../api/orders';

type Responder = unknown | (() => unknown);

/**
 * Answers apiClient.get calls by exact URL (query params aside). A function
 * responder is called on every request, so tests can change what the
 * "server" returns between polls or pushes.
 */
export function mockGet(routes: Record<string, Responder>) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
    if (!(url in routes)) throw new Error(`Unexpected GET ${url}`);
    const responder = routes[url];
    const data = typeof responder === 'function' ? (responder as () => unknown)() : responder;
    return { data };
  });
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customerId: 'customer-1',
    restaurantId: 'restaurant-1',
    status: 'PLACED',
    totalAmount: '29.5',
    createdAt: '2026-10-08T12:00:00.000Z',
    updatedAt: '2026-10-08T12:00:00.000Z',
    lines: [
      { id: 'line-1', menuItemId: 'item-1', name: 'Margherita Pizza', unitPrice: '12.5', quantity: 2 },
      { id: 'line-2', menuItemId: 'item-2', name: 'Garlic Bread', unitPrice: '4.5', quantity: 1 },
    ],
    ...overrides,
  };
}

export const restaurant = {
  id: 'restaurant-1',
  name: "Mario's Pizzeria",
  cuisine: 'Italian',
  address: '12 Market Street',
  isOpen: true,
  description: null,
  menuItems: [],
};
