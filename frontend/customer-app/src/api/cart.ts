import { apiClient } from './client';

// There's no persisted cart yet — this call exists to trigger the
// restaurant-service -> RabbitMQ -> notification-service "hello.world" demo
// event when an item is added to the cart.
export async function addItemToCart(restaurantId: string, menuItemId: string): Promise<void> {
  await apiClient.post(`/restaurants/${restaurantId}/cart/items`, { menuItemId });
}
