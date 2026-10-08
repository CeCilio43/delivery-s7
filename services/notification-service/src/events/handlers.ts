import { subscribeToEvent } from './eventBus';
import { sendToUser } from '../ws/notificationSocket';

// Mirrors libs/events/order.confirmed.json and order.cancelled.json.
interface OrderConfirmedEvent {
  orderId: string;
  customerId: string;
  restaurantId: string;
  confirmedAt: string;
}

interface OrderCancelledEvent {
  orderId: string;
  customerId: string;
  reason: string;
  cancelledAt: string;
}

/** What the customer-app receives when one of its orders changes status. */
export interface OrderUpdatedNotification {
  type: 'order.updated';
  orderId: string;
  status: 'CONFIRMED' | 'CANCELLED';
  reason?: string;
}

export function handleOrderConfirmed(event: OrderConfirmedEvent): void {
  const notification: OrderUpdatedNotification = {
    type: 'order.updated',
    orderId: event.orderId,
    status: 'CONFIRMED',
  };
  sendToUser(event.customerId, notification);
}

export function handleOrderCancelled(event: OrderCancelledEvent): void {
  const notification: OrderUpdatedNotification = {
    type: 'order.updated',
    orderId: event.orderId,
    status: 'CANCELLED',
    reason: event.reason,
  };
  sendToUser(event.customerId, notification);
}

// Events nobody is pushed for yet; logged so the whole flow is visible in
// this service's output.
const LOGGED_ONLY_EVENTS = [
  'order.created',
  'payment.succeeded',
  'payment.failed',
  'restaurant.order_received',
];

export async function registerEventHandlers(): Promise<void> {
  // Each customer is notified only about their own orders.
  await subscribeToEvent('order.confirmed', (payload) =>
    handleOrderConfirmed(payload as OrderConfirmedEvent),
  );
  await subscribeToEvent('order.cancelled', (payload) =>
    handleOrderCancelled(payload as OrderCancelledEvent),
  );

  for (const routingKey of LOGGED_ONLY_EVENTS) {
    await subscribeToEvent(routingKey, (payload) => {
      console.log(`Received ${routingKey} event`, payload);
    });
  }
}
