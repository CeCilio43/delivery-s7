import { subscribeToEvent } from './eventBus';
import { sendToUser } from '../ws/notificationSocket';

// Shared shape of the order status events order-service publishes; mirrors
// libs/events/order.{confirmed,preparing,ready,cancelled}.json.
interface OrderStatusEvent {
  orderId: string;
  customerId: string;
  restaurantId: string;
  restaurantOwnerId: string | null;
  reason?: string;
}

type PushedStatus = 'CONFIRMED' | 'PREPARING' | 'READY' | 'CANCELLED';

/** What the customer-app receives when one of its orders changes status. */
export interface OrderUpdatedNotification {
  type: 'order.updated';
  orderId: string;
  status: PushedStatus;
  reason?: string;
}

/** What the restaurant-app receives when one of its restaurants' orders changes. */
export interface RestaurantOrderUpdatedNotification {
  type: 'restaurant.order_updated';
  orderId: string;
  restaurantId: string;
  status: PushedStatus;
  reason?: string;
}

/** Tells both parties of an order about its new status, each only their own. */
export function notifyOrderStatus(event: OrderStatusEvent, status: PushedStatus): void {
  const reason = event.reason ? { reason: event.reason } : {};

  const toCustomer: OrderUpdatedNotification = {
    type: 'order.updated',
    orderId: event.orderId,
    status,
    ...reason,
  };
  sendToUser(event.customerId, toCustomer);

  if (event.restaurantOwnerId) {
    const toOwner: RestaurantOrderUpdatedNotification = {
      type: 'restaurant.order_updated',
      orderId: event.orderId,
      restaurantId: event.restaurantId,
      status,
      ...reason,
    };
    sendToUser(event.restaurantOwnerId, toOwner);
  }
}

const PUSHED_EVENTS: Record<string, PushedStatus> = {
  'order.confirmed': 'CONFIRMED',
  'order.preparing': 'PREPARING',
  'order.ready': 'READY',
  'order.cancelled': 'CANCELLED',
};

// Events nobody is pushed for; logged so the whole flow is visible in this
// service's output.
const LOGGED_ONLY_EVENTS = [
  'order.created',
  'payment.succeeded',
  'payment.failed',
  'restaurant.order_received',
  'restaurant.created',
  'restaurant.updated',
];

export async function registerEventHandlers(): Promise<void> {
  for (const [routingKey, status] of Object.entries(PUSHED_EVENTS)) {
    await subscribeToEvent(routingKey, (payload) =>
      notifyOrderStatus(payload as OrderStatusEvent, status),
    );
  }

  for (const routingKey of LOGGED_ONLY_EVENTS) {
    await subscribeToEvent(routingKey, (payload) => {
      console.log(`Received ${routingKey} event`, payload);
    });
  }
}
