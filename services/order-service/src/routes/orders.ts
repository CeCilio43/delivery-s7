import { Router } from 'express';
import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { publishEvent } from '../events/eventBus';
import type { OrderCancelledEvent, OrderCreatedEvent } from '../events/types';
import { requireUser } from '../middleware/requireUser';

const router = Router();
router.use('/orders', requireUser);

const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL ?? 'http://localhost:3002';

interface RestaurantMenu {
  id: string;
  isOpen: boolean;
  menuItems: { id: string; name: string; price: string; isAvailable: boolean }[];
}

interface OrderItemInput {
  menuItemId?: unknown;
  quantity?: unknown;
}

// Prices and names come from restaurant-service rather than the request
// body, so a client can't choose what it pays for an item.
async function fetchRestaurantMenu(restaurantId: string): Promise<RestaurantMenu | null> {
  const res = await fetch(`${RESTAURANT_SERVICE_URL}/restaurants/${encodeURIComponent(restaurantId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`restaurant-service responded with ${res.status}`);
  return (await res.json()) as RestaurantMenu;
}

router.post('/orders', async (req, res) => {
  const { restaurantId, items } = (req.body ?? {}) as { restaurantId?: unknown; items?: unknown };

  if (typeof restaurantId !== 'string' || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'restaurantId and a non-empty items array are required' });
  }

  const requested = items as OrderItemInput[];
  for (const item of requested) {
    if (typeof item?.menuItemId !== 'string' || !Number.isInteger(item.quantity) || (item.quantity as number) < 1) {
      return res
        .status(400)
        .json({ error: 'Each item needs a menuItemId and a positive integer quantity' });
    }
  }

  let restaurant: RestaurantMenu | null;
  try {
    restaurant = await fetchRestaurantMenu(restaurantId);
  } catch (err) {
    console.error('Failed to fetch restaurant menu', err);
    return res.status(502).json({ error: 'Could not reach restaurant-service' });
  }

  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }
  if (!restaurant.isOpen) {
    return res.status(409).json({ error: 'Restaurant is currently closed' });
  }

  const lines: { menuItemId: string; name: string; unitPrice: Prisma.Decimal; quantity: number }[] = [];
  for (const item of requested) {
    const menuItem = restaurant.menuItems.find((m) => m.id === item.menuItemId);
    if (!menuItem || !menuItem.isAvailable) {
      return res
        .status(422)
        .json({ error: `Menu item ${String(item.menuItemId)} is not available at this restaurant` });
    }
    lines.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice: new Prisma.Decimal(menuItem.price),
      quantity: item.quantity as number,
    });
  }

  const totalAmount = lines.reduce(
    (sum, line) => sum.plus(line.unitPrice.times(line.quantity)),
    new Prisma.Decimal(0),
  );

  const order = await prisma.order.create({
    data: {
      customerId: req.userId!,
      restaurantId,
      totalAmount,
      lines: { create: lines },
    },
    include: { lines: true },
  });

  const event: OrderCreatedEvent = {
    orderId: order.id,
    customerId: order.customerId,
    restaurantId: order.restaurantId,
    items: lines.map((line) => ({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      price: line.unitPrice.toNumber(),
    })),
    total: totalAmount.toNumber(),
    createdAt: order.createdAt.toISOString(),
  };

  try {
    await publishEvent('order.created', event);
  } catch (err) {
    // Without order.created no payment is ever attempted, so leaving the
    // order PLACED would strand it. Cancel it and let the client retry.
    console.error('Failed to publish order.created event', err);
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
    return res.status(503).json({ error: 'Could not reach the event bus; the order was not placed' });
  }

  return res.status(201).json(order);
});

router.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { customerId: req.userId! },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(orders);
});

router.get('/orders/:id', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, customerId: req.userId! },
    include: { lines: true },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  return res.json(order);
});

const CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PLACED, OrderStatus.CONFIRMED];

router.post('/orders/:id/cancel', async (req, res) => {
  // Conditional update so a concurrent payment.succeeded / cancel can't
  // race this into an invalid transition.
  const { count } = await prisma.order.updateMany({
    where: { id: req.params.id, customerId: req.userId!, status: { in: CANCELLABLE_STATUSES } },
    data: { status: OrderStatus.CANCELLED },
  });

  const order = await prisma.order.findFirst({
    where: { id: req.params.id, customerId: req.userId! },
    include: { lines: true },
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (count === 0) {
    return res.status(409).json({ error: `Order cannot be cancelled while ${order.status}` });
  }

  const event: OrderCancelledEvent = {
    orderId: order.id,
    customerId: order.customerId,
    reason: 'Cancelled by customer',
    cancelledAt: new Date().toISOString(),
  };
  try {
    await publishEvent('order.cancelled', event);
  } catch (err) {
    // The cancellation itself is committed; only downstream reactions (e.g.
    // a refund) are delayed, so report success rather than failing it.
    console.error('Failed to publish order.cancelled event', err);
  }

  return res.json(order);
});

export default router;
