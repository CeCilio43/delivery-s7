import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { AuthenticatedUser } from './middleware/requireAuth';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3005';
const NOTIFICATION_SOCKET_PATH = '/ws/notifications';

// Deliberately created without `ws: true` and never app.use()'d: with both,
// http-proxy-middleware subscribes its own "upgrade" listener on the first
// HTTP request it sees, which would proxy websockets without the auth check
// in handleUpgrade below. Its .upgrade() is only ever called from there.
const notificationSocketProxy = createProxyMiddleware({
  target: NOTIFICATION_SERVICE_URL,
  changeOrigin: true,
  pathFilter: [NOTIFICATION_SOCKET_PATH],
});

/**
 * Verifies the JWT a browser passes as ?token= (the WebSocket API can't set
 * an Authorization header) and, if valid, rewrites the request the same way
 * the HTTP proxies do: the token is removed from the URL, and the caller's
 * identity is forwarded as x-user-id / x-user-role, replacing anything the
 * client sent.
 */
export function authenticateSocketRequest(req: IncomingMessage): AuthenticatedUser | null {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-role'];

  const url = new URL(req.url ?? '/', 'http://gateway');
  const token = url.searchParams.get('token');
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;

  let user: AuthenticatedUser;
  try {
    user = jwt.verify(token, secret) as AuthenticatedUser;
  } catch {
    return null;
  }

  url.searchParams.delete('token');
  req.url = url.pathname + url.search;
  req.headers['x-user-id'] = user.sub;
  req.headers['x-user-role'] = user.role;
  return user;
}

function reject(socket: Socket, status: string) {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** The gateway's only websocket entry point; wired to the HTTP server's "upgrade" event. */
export function handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
  const { pathname } = new URL(req.url ?? '/', 'http://gateway');
  if (pathname !== NOTIFICATION_SOCKET_PATH) {
    reject(socket, '404 Not Found');
    return;
  }
  if (!authenticateSocketRequest(req)) {
    reject(socket, '401 Unauthorized');
    return;
  }
  notificationSocketProxy.upgrade(req, socket, head);
}
