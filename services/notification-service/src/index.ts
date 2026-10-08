import { createServer } from 'http';
import { app } from './app';
import { subscribeToEvent } from './events/eventBus';
import { createNotificationSocket, broadcastNotification } from './ws/notificationSocket';

const PORT = process.env.PORT || 3000;

const server = createServer(app);
createNotificationSocket(server);

subscribeToEvent('hello.world', (payload) => {
  console.log('Received hello.world event', payload);
  broadcastNotification({ type: 'notification', event: 'hello.world', payload });
}).catch((err) => console.error('Failed to subscribe to the event bus', err));

// Order lifecycle events are only logged for now: the websocket is a
// broadcast channel to every connected client, and these carry one
// customer's order details, so they must not be pushed over it until the
// socket is scoped per user.
const ORDER_LIFECYCLE_EVENTS = [
  'order.created',
  'order.confirmed',
  'order.cancelled',
  'payment.succeeded',
  'payment.failed',
  'restaurant.order_received',
];

for (const routingKey of ORDER_LIFECYCLE_EVENTS) {
  subscribeToEvent(routingKey, (payload) => {
    console.log(`Received ${routingKey} event`, payload);
  }).catch((err) => console.error(`Failed to subscribe to ${routingKey}`, err));
}

server.listen(PORT, () => console.log(`notification-service listening on ${PORT}`));
