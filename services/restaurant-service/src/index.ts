import { app } from './app';
import { registerEventHandlers } from './events/handlers';
import { publishRestaurantSnapshot } from './events/restaurantEvents';

const PORT = process.env.PORT || 3000;

registerEventHandlers().catch((err) => console.error('Failed to subscribe to the event bus', err));

// Lets other services (re)build their copy of restaurant ownership, e.g.
// for restaurants that were seeded rather than created through the API.
publishRestaurantSnapshot().catch((err) =>
  console.error('Failed to publish the restaurant snapshot', err),
);

app.listen(PORT, () => console.log(`restaurant-service listening on ${PORT}`));
