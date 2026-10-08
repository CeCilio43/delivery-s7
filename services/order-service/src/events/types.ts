// Payload shapes for the events this service publishes or consumes. Kept in
// sync by hand with the JSON contracts under libs/events.

export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  restaurantId: string;
  items: { menuItemId: string; quantity: number; price: number }[];
  total: number;
  createdAt: string;
}

// Every status change after creation names both parties, so
// notification-service can tell the customer and the restaurant owner.
// restaurantOwnerId is null while the order is unpaid (the restaurant isn't
// involved yet) or if this service doesn't know the owner.
interface OrderStatusEvent {
  orderId: string;
  customerId: string;
  restaurantId: string;
  restaurantOwnerId: string | null;
}

export interface OrderConfirmedEvent extends OrderStatusEvent {
  confirmedAt: string;
}

export interface OrderPreparingEvent extends OrderStatusEvent {
  preparingAt: string;
}

export interface OrderReadyEvent extends OrderStatusEvent {
  readyAt: string;
}

export interface OrderCancelledEvent extends OrderStatusEvent {
  reason: string;
  cancelledAt: string;
}

export interface PaymentSucceededEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  succeededAt: string;
}

export interface PaymentFailedEvent {
  paymentId: string;
  orderId: string;
  reason: string;
  failedAt: string;
}

export interface RestaurantChangedEvent {
  restaurantId: string;
  ownerId: string;
  name: string;
  isOpen: boolean;
  changedAt: string;
}
