import { publishEvent, subscribeToEvent } from './eventBus';

// Mirrors libs/events/order.confirmed.json and restaurant.order_received.json.
export interface OrderConfirmedEvent {
  orderId: string;
  customerId: string;
  restaurantId: string;
  restaurantOwnerId: string | null;
  confirmedAt: string;
}

export interface RestaurantOrderReceivedEvent {
  orderId: string;
  restaurantId: string;
  receivedAt: string;
}

// Once an order is paid for, it lands in the restaurant's queue. There's no
// restaurant dashboard yet, so receiving it is just acknowledged on the bus.
export async function handleOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
  console.log(`Restaurant ${event.restaurantId} received order ${event.orderId}`);
  const received: RestaurantOrderReceivedEvent = {
    orderId: event.orderId,
    restaurantId: event.restaurantId,
    receivedAt: new Date().toISOString(),
  };
  await publishEvent('restaurant.order_received', received);
}

export async function registerEventHandlers(): Promise<void> {
  await subscribeToEvent('restaurant-service.order.confirmed', 'order.confirmed', handleOrderConfirmed);
}
