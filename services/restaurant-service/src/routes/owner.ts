import { Router, type Response } from 'express';
import { prisma } from '../prisma';
import { requireOwner } from '../middleware/requireOwner';
import { publishRestaurantCreated, publishRestaurantUpdated } from '../events/restaurantEvents';
import {
  parseMenuItemUpdate,
  parseNewMenuItem,
  parseNewRestaurant,
  parseRestaurantUpdate,
} from '../validation';

// Everything a restaurant owner manages: their restaurants' details, whether
// they're open, and their menus. Reached through the api-gateway at
// /owner/restaurants, which only lets RESTAURANT_OWNER tokens through.
const router = Router();
router.use('/owner', requireOwner);

const withMenu = { menuItems: { orderBy: { createdAt: 'asc' as const } } };

/** The restaurant with this id if the caller owns it; otherwise sends 404. */
async function findOwnedRestaurant(id: string, ownerId: string, res: Response) {
  const restaurant = await prisma.restaurant.findFirst({ where: { id, ownerId } });
  // 404 rather than 403 for someone else's restaurant, so ids can't be probed.
  if (!restaurant) res.status(404).json({ error: 'Restaurant not found' });
  return restaurant;
}

// Restaurant changes are committed before they're published; a failed
// publish is logged rather than failing the request, and the startup
// snapshot (publishRestaurantSnapshot) brings consumers back in sync.
async function publishSafely(publish: () => Promise<void>) {
  try {
    await publish();
  } catch (err) {
    console.error('Failed to publish restaurant event', err);
  }
}

router.get('/owner/restaurants', async (req, res) => {
  const restaurants = await prisma.restaurant.findMany({
    where: { ownerId: req.ownerId! },
    include: withMenu,
    orderBy: { createdAt: 'asc' },
  });
  return res.json(restaurants);
});

router.post('/owner/restaurants', async (req, res) => {
  const parsed = parseNewRestaurant(req.body);
  if (parsed.error !== undefined) return res.status(400).json({ error: parsed.error });

  // New restaurants start closed, so customers can't order before the
  // owner has set up a menu and opened up.
  const restaurant = await prisma.restaurant.create({
    data: { ...parsed.data, ownerId: req.ownerId!, isOpen: false },
    include: withMenu,
  });
  await publishSafely(() => publishRestaurantCreated(restaurant));
  return res.status(201).json(restaurant);
});

router.get('/owner/restaurants/:id', async (req, res) => {
  const owned = await findOwnedRestaurant(req.params.id, req.ownerId!, res);
  if (!owned) return;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: owned.id }, include: withMenu });
  return res.json(restaurant);
});

router.patch('/owner/restaurants/:id', async (req, res) => {
  const parsed = parseRestaurantUpdate(req.body);
  if (parsed.error !== undefined) return res.status(400).json({ error: parsed.error });

  const owned = await findOwnedRestaurant(req.params.id, req.ownerId!, res);
  if (!owned) return;

  const restaurant = await prisma.restaurant.update({
    where: { id: owned.id },
    data: parsed.data,
    include: withMenu,
  });
  await publishSafely(() => publishRestaurantUpdated(restaurant));
  return res.json(restaurant);
});

router.post('/owner/restaurants/:id/menu-items', async (req, res) => {
  const parsed = parseNewMenuItem(req.body);
  if (parsed.error !== undefined) return res.status(400).json({ error: parsed.error });

  const owned = await findOwnedRestaurant(req.params.id, req.ownerId!, res);
  if (!owned) return;

  const menuItem = await prisma.menuItem.create({
    data: { ...parsed.data, restaurantId: owned.id },
  });
  return res.status(201).json(menuItem);
});

router.patch('/owner/restaurants/:id/menu-items/:itemId', async (req, res) => {
  const parsed = parseMenuItemUpdate(req.body);
  if (parsed.error !== undefined) return res.status(400).json({ error: parsed.error });

  const owned = await findOwnedRestaurant(req.params.id, req.ownerId!, res);
  if (!owned) return;

  const { count } = await prisma.menuItem.updateMany({
    where: { id: req.params.itemId, restaurantId: owned.id },
    data: parsed.data,
  });
  if (count === 0) return res.status(404).json({ error: 'Menu item not found' });

  const menuItem = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
  return res.json(menuItem);
});

// Past orders keep their own copy of each item's name and price, so deleting
// a menu item never changes an existing order.
router.delete('/owner/restaurants/:id/menu-items/:itemId', async (req, res) => {
  const owned = await findOwnedRestaurant(req.params.id, req.ownerId!, res);
  if (!owned) return;

  const { count } = await prisma.menuItem.deleteMany({
    where: { id: req.params.itemId, restaurantId: owned.id },
  });
  if (count === 0) return res.status(404).json({ error: 'Menu item not found' });
  return res.status(204).end();
});

export default router;
