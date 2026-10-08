import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import WebSocket from 'ws';
import { createNotificationSocket, sendToUser } from './notificationSocket';

let server: Server;
let baseUrl: string;
const openSockets: WebSocket[] = [];

beforeAll(async () => {
  server = createServer();
  createNotificationSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `ws://localhost:${(server.address() as AddressInfo).port}/ws/notifications`;
});

afterEach(() => {
  for (const socket of openSockets.splice(0)) socket.close();
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** Connects as the given user and collects every message after the "connected" ack. */
function connectAs(userId: string): Promise<{ messages: unknown[] }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(baseUrl, { headers: { 'x-user-id': userId } });
    openSockets.push(socket);
    const messages: unknown[] = [];
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'connected') resolve({ messages });
      else messages.push(message);
    });
    socket.on('error', reject);
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('notification socket', () => {
  it('refuses connections that did not come through the gateway', async () => {
    const status = await new Promise<number>((resolve) => {
      const socket = new WebSocket(baseUrl);
      socket.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      socket.on('error', () => resolve(0));
    });
    expect(status).toBe(401);
  });

  it("sends a user's notifications only to that user, on every connection", async () => {
    const aliceTab1 = await connectAs('alice');
    const aliceTab2 = await connectAs('alice');
    const bob = await connectAs('bob');

    sendToUser('alice', { type: 'order.updated', orderId: 'order-1', status: 'CONFIRMED' });
    await flush();

    const expected = { type: 'order.updated', orderId: 'order-1', status: 'CONFIRMED' };
    expect(aliceTab1.messages).toEqual([expected]);
    expect(aliceTab2.messages).toEqual([expected]);
    expect(bob.messages).toEqual([]);
  });
});
