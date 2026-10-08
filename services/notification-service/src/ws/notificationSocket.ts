import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

// One user can have several connections open (e.g. multiple tabs).
const socketsByUser = new Map<string, Set<WebSocket>>();

/**
 * Attaches a websocket server to the given HTTP server at /ws/notifications.
 *
 * Connections must come through the api-gateway, which verifies the JWT and
 * forwards the caller as x-user-id; anything else is refused, so every
 * socket is tied to a known user.
 */
export function createNotificationSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({
    server,
    path: '/ws/notifications',
    verifyClient: ({ req }, done) => {
      if (req.headers['x-user-id']) done(true);
      else done(false, 401, 'Unauthorized');
    },
  });

  wss.on('connection', (socket, req) => {
    const userId = req.headers['x-user-id'] as string;

    let sockets = socketsByUser.get(userId);
    if (!sockets) {
      sockets = new Set();
      socketsByUser.set(userId, sockets);
    }
    sockets.add(socket);

    socket.on('close', () => {
      sockets.delete(socket);
      if (sockets.size === 0) socketsByUser.delete(userId);
    });

    socket.send(JSON.stringify({ type: 'connected', message: 'Connected to notification-service' }));
  });

  return wss;
}

function send(socket: WebSocket, data: string) {
  if (socket.readyState === WebSocket.OPEN) socket.send(data);
}

/** Sends a JSON-serializable notification to every connection of one user. */
export function sendToUser(userId: string, notification: object): void {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return;
  const data = JSON.stringify(notification);
  for (const socket of sockets) send(socket, data);
}
