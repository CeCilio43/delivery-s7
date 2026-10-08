import { OrderStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { subscribeToEvent } from './eventBus';
import { publishOrderCancelled, publishOrderConfirmed } from './orderEvents';
import type { PaymentFailedEvent, PaymentSucceededEvent, RestaurantChangedEvent } from './types';

// Payment outcomes only move an order that is still PLACED, so a redelivered
// event or one that arrives after the customer cancelled is a no-op.

export async function handlePaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
  const { count } = await prisma.order.updateMany({
    where: { id: event.orderId, status: OrderStatus.PLACED },
    data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
  });
  if (count === 0) return;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: event.orderId } });
  await publishOrderConfirmed(order);
}

export async function handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
  const { count } = await prisma.order.updateMany({
    where: { id: event.orderId, status: OrderStatus.PLACED },
    data: { status: OrderStatus.CANCELLED },
  });
  if (count === 0) return;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: event.orderId } });
  await publishOrderCancelled(order, `Payment failed: ${event.reason}`);
}

// Keeps this service's copy of restaurant ownership current. Upserting makes
// redelivered events and restaurant-service's startup snapshot harmless.
export async function handleRestaurantChanged(event: RestaurantChangedEvent): Promise<void> {
  await prisma.restaurantProjection.upsert({
    where: { id: event.restaurantId },
    create: { id: event.restaurantId, ownerId: event.ownerId, name: event.name },
    update: { ownerId: event.ownerId, name: event.name },
  });
}

export async function registerEventHandlers(): Promise<void> {
  await subscribeToEvent('order-service.payment.succeeded', 'payment.succeeded', handlePaymentSucceeded);
  await subscribeToEvent('order-service.payment.failed', 'payment.failed', handlePaymentFailed);
  await subscribeToEvent('order-service.restaurant.created', 'restaurant.created', handleRestaurantChanged);
  await subscribeToEvent('order-service.restaurant.updated', 'restaurant.updated', handleRestaurantChanged);
}
