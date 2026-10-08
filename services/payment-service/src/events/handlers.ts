import { randomUUID } from 'crypto';
import { PaymentStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { publishEvent, subscribeToEvent } from './eventBus';
import type {
  OrderCancelledEvent,
  OrderCreatedEvent,
  PaymentFailedEvent,
  PaymentSucceededEvent,
} from './types';

// There's no real payment provider yet. This stand-in approves every charge
// up to PAYMENT_DECLINE_ABOVE and declines anything larger, so both the
// success and failure paths of the order flow can be exercised on demand.
function declineLimit(): number {
  return Number(process.env.PAYMENT_DECLINE_ABOVE ?? 100);
}

export async function handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
  // RabbitMQ delivers at-least-once; never charge the same order twice.
  const existing = await prisma.transaction.findFirst({ where: { orderId: event.orderId } });
  if (existing) return;

  const transaction = await prisma.transaction.create({
    data: {
      orderId: event.orderId,
      customerId: event.customerId,
      amount: event.total,
      status: PaymentStatus.PENDING,
    },
  });

  if (event.total > declineLimit()) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: PaymentStatus.FAILED },
    });
    const failed: PaymentFailedEvent = {
      paymentId: transaction.id,
      orderId: event.orderId,
      reason: `Amount ${event.total.toFixed(2)} exceeds the card limit of ${declineLimit().toFixed(2)}`,
      failedAt: new Date().toISOString(),
    };
    await publishEvent('payment.failed', failed);
    return;
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: PaymentStatus.SUCCEEDED, providerRef: `sim_${randomUUID()}` },
  });
  const succeeded: PaymentSucceededEvent = {
    paymentId: transaction.id,
    orderId: event.orderId,
    amount: event.total,
    succeededAt: new Date().toISOString(),
  };
  await publishEvent('payment.succeeded', succeeded);
}

// A customer can cancel an order after it was paid for; refund it then.
export async function handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
  await prisma.transaction.updateMany({
    where: { orderId: event.orderId, status: PaymentStatus.SUCCEEDED },
    data: { status: PaymentStatus.REFUNDED },
  });
}

export async function registerEventHandlers(): Promise<void> {
  await subscribeToEvent('payment-service.order.created', 'order.created', handleOrderCreated);
  await subscribeToEvent('payment-service.order.cancelled', 'order.cancelled', handleOrderCancelled);
}
