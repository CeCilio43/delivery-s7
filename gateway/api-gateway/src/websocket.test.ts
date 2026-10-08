import { createServer, type IncomingMessage, type Server } from 'http';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import WebSocket, { WebSocketServer } from 'ws';

// A stand-in notification-service that records the upgrade request it got.
let upstream: Server;
let upstreamWss: WebSocketServer;
let received: IncomingMessage[] = [];
let gateway: Server;
let gatewayUrl: string;

function listen(server: Server): Promise<number> {
  return new Promise((resolve) =>
    server.listen(0, () => resolve((server.address() as AddressInfo).port)),
  );
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/** Resolves with the connection on open, or the HTTP status it was refused with. */
function connect(path: string, headers: Record<string, string> = {}) {
  return new Promise<{ socket?: WebSocket; status?: number }>((resolve) => {
    const socket = new WebSocket(`${gatewayUrl}${path}`, { headers });
    socket.on('open', () => resolve({ socket }));
    socket.on('unexpected-response', (_req, res) => resolve({ status: res.statusCode }));
    socket.on('error', () => resolve({}));
  });
}

beforeAll(async () => {
  upstream = createServer();
  upstreamWss = new WebSocketServer({ server: upstream });
  upstreamWss.on('connection', (_socket, req) => received.push(req));
  const upstreamPort = await listen(upstream);

  // websocket.ts reads the target URL at import time, so set it first.
  process.env.NOTIFICATION_SERVICE_URL = `http://localhost:${upstreamPort}`;
  process.env.JWT_SECRET = 'test-secret';
  const { handleUpgrade } = await import('./websocket');

  gateway = createServer();
  gateway.on('upgrade', handleUpgrade);
  gatewayUrl = `ws://localhost:${await listen(gateway)}`;
});

afterAll(async () => {
  upstreamWss.close();
  await Promise.all([close(gateway), close(upstream)]);
});

beforeEach(() => {
  received = [];
});

describe('notification websocket', () => {
  it('refuses a connection without a token', async () => {
    const result = await connect('/ws/notifications');
    expect(result.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it('refuses a connection with an invalid token', async () => {
    const result = await connect('/ws/notifications?token=not-a-jwt');
    expect(result.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it('refuses websocket upgrades on other paths', async () => {
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER' }, 'test-secret');
    const result = await connect(`/orders?token=${token}`);
    expect(result.status).toBe(404);
  });

  it('forwards the verified user and strips the token and spoofed headers', async () => {
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER' }, 'test-secret');

    const result = await connect(`/ws/notifications?token=${token}`, {
      'x-user-id': 'someone-else',
      'x-user-role': 'ADMIN',
    });

    expect(result.socket).toBeDefined();
    result.socket?.close();
    expect(received).toHaveLength(1);
    expect(received[0]?.url).toBe('/ws/notifications');
    expect(received[0]?.headers['x-user-id']).toBe('user-1');
    expect(received[0]?.headers['x-user-role']).toBe('CUSTOMER');
  });
});
