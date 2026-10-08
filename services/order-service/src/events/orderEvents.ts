import type { Order } from '@prisma/client';
import { prisma } from '../prisma';
import { publishEvent } from './eventBus';
import type {
  OrderCancelledEvent,
  OrderConfirmedEvent,
  OrderPreparingEvent,
  OrderReadyEvent,
} from './types';

type OrderRef = Pick<Order, 'id' | 'customerId' | 'restaurantId' | 'confirmedAt'>;

// The restaurant only gets involved once an order is paid, so events about
// unpaid orders (e.g. a declined payment) carry no owner and the owner is
// never told about an order they never saw.
async function ownerToNotify(order: OrderRef): Promise<string | null> {
  if (!order.confirmedAt) return null;
  const restaurant = await prisma.restaurantProjection.findUnique({
    where: { id: order.restaurantId },
  });
  if (!restaurant) {
    console.warn(`No known owner for restaurant ${order.restaurantId}; only the customer is notified`);
  }
  return restaurant?.ownerId ?? null;
}

async function statusEventBase(order: OrderRef) {
  return {
    orderId: order.id,
    customerId: order.customerId,
    restaurantId: order.restaurantId,
    restaurantOwnerId: await ownerToNotify(order),
  };
}

const now = () => new Date().toISOString();

export async function publishOrderConfirmed(order: OrderRef): Promise<void> {
  const event: OrderConfirmedEvent = { ...(await statusEventBase(order)), confirmedAt: now() };
  await publishEvent('order.confirmed', event);
}

export async function publishOrderPreparing(order: OrderRef): Promise<void> {
  const event: OrderPreparingEvent = { ...(await statusEventBase(order)), preparingAt: now() };
  await publishEvent('order.preparing', event);
}

export async function publishOrderReady(order: OrderRef): Promise<void> {
  const event: OrderReadyEvent = { ...(await statusEventBase(order)), readyAt: now() };
  await publishEvent('order.ready', event);
}

export async function publishOrderCancelled(order: OrderRef, reason: string): Promise<void> {
  const event: OrderCancelledEvent = {
    ...(await statusEventBase(order)),
    reason,
    cancelledAt: now(),
  };
  await publishEvent('order.cancelled', event);
}

/**
 * For changes that are already committed: a failed publish only delays what
 * other services do in reaction (notifications, refunds), so it's logged
 * instead of failing the request.
 */
export async function publishSafely(publish: () => Promise<void>): Promise<void> {
  try {
    await publish();
  } catch (err) {
    console.error('Failed to publish order event', err);
  }
}
