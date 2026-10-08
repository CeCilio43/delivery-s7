import { createServer } from 'http';
import { app } from './app';
import { registerEventHandlers } from './events/handlers';
import { createNotificationSocket } from './ws/notificationSocket';

const PORT = process.env.PORT || 3000;

const server = createServer(app);
createNotificationSocket(server);

registerEventHandlers().catch((err) => console.error('Failed to subscribe to the event bus', err));

server.listen(PORT, () => console.log(`notification-service listening on ${PORT}`));
