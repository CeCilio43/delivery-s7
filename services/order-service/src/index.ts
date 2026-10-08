import { app } from './app';
import { registerEventHandlers } from './events/handlers';

const PORT = process.env.PORT || 3000;

registerEventHandlers().catch((err) => console.error('Failed to subscribe to the event bus', err));

app.listen(PORT, () => console.log(`order-service listening on ${PORT}`));
