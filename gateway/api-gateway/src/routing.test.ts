import { createServer, type IncomingHttpHeaders, type Server } from 'http';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';

// A stand-in order-service that records the headers each request arrived
// with, so the test can assert what the gateway forwarded.
let upstream: Server;
let received: IncomingHttpHeaders[] = [];
let app: Express;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    received.push(req.headers);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ path: req.url }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, resolve));

  // app.ts reads service URLs at import time, so point it at the stub first.
  process.env.ORDER_SERVICE_URL = `http://localhost:${(upstream.address() as AddressInfo).port}`;
  process.env.JWT_SECRET = 'test-secret';
  ({ app } = await import('./app'));
});

afterAll(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

beforeEach(() => {
  received = [];
});

describe('protected routes', () => {
  it('rejects /orders without a token and never reaches the service', async () => {
    const res = await request(app).get('/orders');
    expect(res.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it("forwards the verified user's id and role, overriding spoofed headers", async () => {
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER' }, 'test-secret');

    const res = await request(app)
      .get('/orders/abc')
      .set('Authorization', `Bearer ${token}`)
      .set('x-user-id', 'someone-else')
      .set('x-user-role', 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ path: '/orders/abc' });
    expect(received[0]?.['x-user-id']).toBe('user-1');
    expect(received[0]?.['x-user-role']).toBe('CUSTOMER');
  });
});

describe('API docs', () => {
  it('serves the OpenAPI spec', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/login', '/restaurants', '/orders', '/payments']),
    );
  });

  it('serves Swagger UI without requiring a token', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
