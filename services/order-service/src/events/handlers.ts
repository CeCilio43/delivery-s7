import { OrderStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { publishEvent, subscribeToEvent } from './eventBus';
import type {
  OrderCancelledEvent,
  OrderConfirmedEvent,
  PaymentFailedEvent,
  PaymentSucceededEvent,
} from './types';

// Payment outcomes only move an order that is still PLACED, so a redelivered
// event or one that arrives after the customer cancelled is a no-op.

export async function handlePaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
  const { count } = await prisma.order.updateMany({
    where: { id: event.orderId, status: OrderStatus.PLACED },
    data: { status: OrderStatus.CONFIRMED },
  });
  if (count === 0) return;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: event.orderId } });
  const confirmed: OrderConfirmedEvent = {
    orderId: order.id,
    restaurantId: order.restaurantId,
    confirmedAt: new Date().toISOString(),
  };
  await publishEvent('order.confirmed', confirmed);
}

export async function handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
  const { count } = await prisma.order.updateMany({
    where: { id: event.orderId, status: OrderStatus.PLACED },
    data: { status: OrderStatus.CANCELLED },
  });
  if (count === 0) return;

  const cancelled: OrderCancelledEvent = {
    orderId: event.orderId,
    reason: `Payment failed: ${event.reason}`,
    cancelledAt: new Date().toISOString(),
  };
  await publishEvent('order.cancelled', cancelled);
}

export async function registerEventHandlers(): Promise<void> {
  await subscribeToEvent('order-service.payment.succeeded', 'payment.succeeded', handlePaymentSucceeded);
  await subscribeToEvent('order-service.payment.failed', 'payment.failed', handlePaymentFailed);
}
