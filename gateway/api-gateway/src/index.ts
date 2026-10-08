import { createServer } from 'http';
import { app } from './app';
import { handleUpgrade } from './websocket';

const PORT = process.env.PORT || 3000;

// Express never emits an "upgrade" event, so websocket proxying needs to be
// wired to the raw HTTP server directly. handleUpgrade authenticates the
// connection before proxying it to notification-service.
const server = createServer(app);
server.on('upgrade', handleUpgrade);

server.listen(PORT, () => console.log(`api-gateway listening on ${PORT}`));
