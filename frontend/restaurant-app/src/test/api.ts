import { vi } from 'vitest';
import { apiClient } from '../api/client';
import type { Order } from '../api/orders';
import type { Restaurant } from '../api/restaurants';

type Method = 'get' | 'post' | 'patch' | 'delete';
type Responder = unknown | ((body: unknown, params: Record<string, unknown> | undefined) => unknown);

/**
 * Answers apiClient calls by method and exact URL, e.g.
 * `{ 'get /owner/restaurants': [restaurant] }`. Function responders get the
 * request body (or query params for GET) and run on every call, so tests can
 * change what the "server" returns over time. Returns the spies.
 */
export function mockApi(routes: Record<string, Responder>) {
  const respond = (method: Method) => async (url: string, bodyOrConfig?: unknown) => {
    const key = `${method} ${url}`;
    if (!(key in routes)) throw new Error(`Unexpected ${key}`);
    const responder = routes[key];
    const params =
      method === 'get' ? (bodyOrConfig as { params?: Record<string, unknown> } | undefined)?.params : undefined;
    const data =
      typeof responder === 'function'
        ? (responder as (body: unknown, params?: Record<string, unknown>) => unknown)(bodyOrConfig, params)
        : responder;
    return { data };
  };
  return {
    get: vi.spyOn(apiClient, 'get').mockImplementation(respond('get')),
    post: vi.spyOn(apiClient, 'post').mockImplementation(respond('post')),
    patch: vi.spyOn(apiClient, 'patch').mockImplementation(respond('patch')),
    delete: vi.spyOn(apiClient, 'delete').mockImplementation(respond('delete')),
  };
}

export function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'restaurant-1',
    name: "Mario's Pizzeria",
    description: null,
    cuisine: 'Italian',
    address: '12 Market Street',
    isOpen: true,
    menuItems: [
      {
        id: 'item-1',
        restaurantId: 'restaurant-1',
        name: 'Margherita Pizza',
        description: 'Tomato, mozzarella, basil',
        price: '12.5',
        isAvailable: true,
      },
    ],
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000001',
    customerId: 'customer-1',
    restaurantId: 'restaurant-1',
    status: 'CONFIRMED',
    totalAmount: '29.5',
    confirmedAt: '2026-10-08T12:00:00.000Z',
    createdAt: '2026-10-08T11:59:00.000Z',
    updatedAt: '2026-10-08T12:00:00.000Z',
    lines: [
      { id: 'line-1', menuItemId: 'item-1', name: 'Margherita Pizza', unitPrice: '12.5', quantity: 2 },
      { id: 'line-2', menuItemId: 'item-2', name: 'Garlic Bread', unitPrice: '4.5', quantity: 1 },
    ],
    ...overrides,
  };
}

/** A GET /owner/orders responder that filters `orders` by the requested statuses. */
export function ordersByStatus(getOrders: () => Order[]) {
  return (_body: unknown, params?: Record<string, unknown>) => {
    const statuses = typeof params?.status === 'string' ? params.status.split(',') : null;
    return getOrders().filter((o) => !statuses || statuses.includes(o.status));
  };
}
