import { apiClient } from './client';

// The cart itself lives in the browser (see context/CartContext.tsx). This
// call only triggers the restaurant-service -> RabbitMQ ->
// notification-service "hello.world" demo event when an item is added.
export async function addItemToCart(restaurantId: string, menuItemId: string): Promise<void> {
  await apiClient.post(`/restaurants/${restaurantId}/cart/items`, { menuItemId });
}
