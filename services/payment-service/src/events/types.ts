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

export interface OrderConfirmedEvent {
  orderId: string;
  customerId: string;
  restaurantId: string;
  confirmedAt: string;
}

export interface OrderCancelledEvent {
  orderId: string;
  customerId: string;
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
