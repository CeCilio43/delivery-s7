import { Router, type Request, type Response } from 'express';
import { OrderStatus, type Order } from '@prisma/client';
import { prisma } from '../prisma';
import { requireOwner } from '../middleware/requireOwner';
import {
  publishOrderCancelled,
  publishOrderPreparing,
  publishOrderReady,
  publishSafely,
} from '../events/orderEvents';

// A restaurant owner working through their restaurants' orders. Reached
// through the api-gateway at /owner/orders, which only lets RESTAURANT_OWNER
// tokens through. Ownership comes from RestaurantProjection, this service's
// copy of restaurant-service's data.
const router = Router();
router.use('/owner', requireOwner);

const MAX_REASON_LENGTH = 200;
const ORDER_LIST_LIMIT = 200;

async function ownedRestaurantIds(ownerId: string): Promise<string[]> {
  const restaurants = await prisma.restaurantProjection.findMany({
    where: { ownerId },
    select: { id: true },
  });
  return restaurants.map((r) => r.id);
}

function parseStatuses(value: unknown): OrderStatus[] | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const statuses = value.split(',').map((s) => s.trim());
  return statuses.every((s): s is OrderStatus => s in OrderStatus) ? statuses : null;
}

router.get('/owner/orders', async (req, res) => {
  const statuses = parseStatuses(req.query.status);
  if (statuses === null) {
    return res.status(400).json({ error: `status must be a comma-separated list of ${Object.keys(OrderStatus).join(', ')}` });
  }

  let restaurantIds = await ownedRestaurantIds(req.ownerId!);
  if (typeof req.query.restaurantId === 'string') {
    if (!restaurantIds.includes(req.query.restaurantId)) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    restaurantIds = [req.query.restaurantId];
  }

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: { in: restaurantIds },
      // Only paid orders reach the restaurant; unpaid or declined ones don't.
      confirmedAt: { not: null },
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    include: { lines: true },
    orderBy: { confirmedAt: 'asc' },
    take: ORDER_LIST_LIMIT,
  });
  return res.json(orders);
});

async function findOwnedOrder(req: Request, res: Response) {
  const order = await prisma.order.findFirst({
    where: {
      id: req.params.id as string,
      restaurantId: { in: await ownedRestaurantIds(req.ownerId!) },
      confirmedAt: { not: null },
    },
    include: { lines: true },
  });
  // 404 rather than 403 for another restaurant's order, so ids can't be probed.
  if (!order) res.status(404).json({ error: 'Order not found' });
  return order;
}

router.get('/owner/orders/:id', async (req, res) => {
  const order = await findOwnedOrder(req, res);
  if (order) res.json(order);
});

/**
 * Moves one of the owner's orders from one of `from` to `to`, then runs
 * `publish`. The update is conditional on the current status, so two
 * concurrent actions (e.g. the customer cancelling while the owner accepts)
 * can't both succeed.
 */
async function transition(
  req: Request,
  res: Response,
  from: OrderStatus[],
  to: OrderStatus,
  verb: string,
  publish: (order: Order) => Promise<void>,
) {
  const owned = await findOwnedOrder(req, res);
  if (!owned) return;

  const { count } = await prisma.order.updateMany({
    where: { id: owned.id, status: { in: from } },
    data: { status: to },
  });
  if (count === 0) {
    const current = await prisma.order.findUniqueOrThrow({ where: { id: owned.id } });
    return res.status(409).json({ error: `Order cannot be ${verb} while ${current.status}` });
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: owned.id },
    include: { lines: true },
  });
  await publishSafely(() => publish(order));
  return res.json(order);
}

// Accepting a paid order means the kitchen starts on it.
router.post('/owner/orders/:id/accept', (req, res) =>
  transition(req, res, [OrderStatus.CONFIRMED], OrderStatus.PREPARING, 'accepted', publishOrderPreparing),
);

router.post('/owner/orders/:id/ready', (req, res) =>
  transition(req, res, [OrderStatus.PREPARING], OrderStatus.READY, 'marked ready', publishOrderReady),
);

// Rejecting cancels the order; payment-service refunds it on order.cancelled.
router.post('/owner/orders/:id/reject', (req, res) => {
  const raw = (req.body as { reason?: unknown } | undefined)?.reason;
  if (raw !== undefined && typeof raw !== 'string') {
    return res.status(400).json({ error: 'reason must be a string' });
  }
  const detail = (raw ?? '').trim();
  if (detail.length > MAX_REASON_LENGTH) {
    return res.status(400).json({ error: `reason must be at most ${MAX_REASON_LENGTH} characters` });
  }
  const reason = detail ? `Rejected by the restaurant: ${detail}` : 'Rejected by the restaurant';

  return transition(
    req,
    res,
    [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
    OrderStatus.CANCELLED,
    'rejected',
    (order) => publishOrderCancelled(order, reason),
  );
});

export default router;
