import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requireAuth } from './middleware/requireAuth';

export const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';

// Auth routes are unauthenticated by design and proxy straight through to
// user-service, so they're mounted ahead of the requireAuth gate below.
const PUBLIC_AUTH_PATHS = ['/register', '/login', '/auth/google', '/auth/google/callback'];

app.use(
  PUBLIC_AUTH_PATHS,
  createProxyMiddleware({ target: USER_SERVICE_URL, changeOrigin: true }),
);

// Everything mounted after this point requires a valid JWT.
app.use(requireAuth);
