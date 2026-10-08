import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

/** Attaches a websocket server to the given HTTP server at /ws/notifications. */
export function createNotificationSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws/notifications' });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected', message: 'Connected to notification-service' }));
  });

  return wss;
}

/** Broadcasts a JSON-serializable notification to every connected client. */
export function broadcastNotification(notification: Record<string, unknown>): void {
  if (!wss) return;
  const data = JSON.stringify(notification);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
