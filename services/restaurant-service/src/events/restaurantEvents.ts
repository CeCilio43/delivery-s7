import type { Restaurant } from '@prisma/client';
import { prisma } from '../prisma';
import { publishEvent } from './eventBus';

// Mirrors libs/events/restaurant.created.json and restaurant.updated.json.
// Other services keep their own copy of who owns which restaurant from these
// (order-service uses it to authorize owners), so every change that touches
// these fields must be published.
export interface RestaurantChangedEvent {
  restaurantId: string;
  ownerId: string;
  name: string;
  isOpen: boolean;
  changedAt: string;
}

function toEvent(restaurant: Restaurant): RestaurantChangedEvent {
  return {
    restaurantId: restaurant.id,
    ownerId: restaurant.ownerId,
    name: restaurant.name,
    isOpen: restaurant.isOpen,
    changedAt: new Date().toISOString(),
  };
}

export async function publishRestaurantCreated(restaurant: Restaurant): Promise<void> {
  await publishEvent('restaurant.created', toEvent(restaurant));
}

export async function publishRestaurantUpdated(restaurant: Restaurant): Promise<void> {
  await publishEvent('restaurant.updated', toEvent(restaurant));
}

/**
 * Publishes the current state of every restaurant. Run at startup so that
 * consumers also learn about restaurants created before they subscribed
 * (e.g. seeded data); consumers upsert, so repeating this is harmless.
 */
export async function publishRestaurantSnapshot(): Promise<void> {
  const restaurants = await prisma.restaurant.findMany();
  for (const restaurant of restaurants) {
    await publishRestaurantUpdated(restaurant);
  }
}
