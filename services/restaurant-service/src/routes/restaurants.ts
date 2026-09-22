import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/restaurants', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const restaurants = await prisma.restaurant.findMany({
    ...(search
      ? {
          where: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { cuisine: { contains: search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
    select: {
      id: true,
      name: true,
      cuisine: true,
      address: true,
      isOpen: true,
    },
  });

  return res.json(restaurants);
});

router.get('/restaurants/:id', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.params.id },
    include: { menuItems: true },
  });

  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }

  return res.json(restaurant);
});

export default router;
