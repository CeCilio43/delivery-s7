import request from 'supertest';
import { app } from './app';

describe('GET /health', () => {
  it('returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-gateway' });
  });
});

describe('CORS', () => {
  it.each(['http://localhost:5173', 'http://localhost:5174'])(
    'allows the frontend at %s',
    async (origin) => {
      const res = await request(app).options('/orders').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    },
  );

  it('does not allow other origins', async () => {
    const res = await request(app).options('/orders').set('Origin', 'http://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
