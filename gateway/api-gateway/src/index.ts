import { createServer } from 'http';
import { app, notificationSocketProxy } from './app';

const PORT = process.env.PORT || 3000;

// Express never emits an "upgrade" event, so websocket proxying needs to be
// wired to the raw HTTP server directly.
const server = createServer(app);
server.on('upgrade', notificationSocketProxy.upgrade);

server.listen(PORT, () => console.log(`api-gateway listening on ${PORT}`));
