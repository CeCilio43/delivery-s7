import { Router } from 'express';
import { prisma } from '../prisma';
import { publishEvent } from '../events/eventBus';

const router = Router();

// Demo endpoint: adding a menu item to the cart publishes a "hello.world"
// event onto the EventBus (RabbitMQ) for notification-service to pick up and
// push to the customer over a websocket. There's no persisted cart yet —
// this exists to prove the event-driven wiring between services works.
router.post('/restaurants/:restaurantId/cart/items', async (req, res) => {
  const { restaurantId } = req.params;
  const { menuItemId } = req.body as { menuItemId?: string };

  if (!menuItemId) {
    return res.status(400).json({ error: 'menuItemId is required' });
  }

  const menuItem = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
  });

  if (!menuItem) {
    return res.status(404).json({ error: 'Menu item not found for this restaurant' });
  }

  try {
    await publishEvent('hello.world', {
      message: `Hello World! "${menuItem.name}" was added to your cart.`,
      source: 'restaurant-service',
      restaurantId,
      menuItemId,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to publish hello.world event', err);
    return res.status(502).json({ error: 'Could not reach the event bus' });
  }

  return res.status(202).json({ status: 'ok', eventPublished: 'hello.world' });
});

export default router;
