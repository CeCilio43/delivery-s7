import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requireAuth } from './middleware/requireAuth';

export const app = express();

// The customer-app runs on a different origin (Vite dev server) and sends
// an Authorization header on protected requests, both of which trigger a
// CORS preflight that the browser blocks without this.
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
app.use(cors({ origin: FRONTEND_URL }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL ?? 'http://localhost:3002';

// Auth routes are unauthenticated by design and proxy straight through to
// user-service, so they're mounted ahead of the requireAuth gate below.
const PUBLIC_AUTH_PATHS = ['/register', '/login', '/auth/google', '/auth/google/callback'];

// Restaurant browsing is public too — /restaurants covers both GET /restaurants
// and GET /restaurants/:id, since pathFilter matches on prefix.
const PUBLIC_RESTAURANT_PATHS = ['/restaurants'];

// Mounted at the root (not on the path lists above) so Express doesn't strip
// the matched prefix from req.url before the proxy forwards it — app.use(path,
// mw) rewrites req.url to be relative to the mount point, which turns e.g.
// POST /register into POST / by the time it reaches user-service. pathFilter
// does the path matching instead, without touching req.url.
app.use(
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathFilter: PUBLIC_AUTH_PATHS,
  }),
);

app.use(
  createProxyMiddleware({
    target: RESTAURANT_SERVICE_URL,
    changeOrigin: true,
    pathFilter: PUBLIC_RESTAURANT_PATHS,
  }),
);

// Everything mounted after this point requires a valid JWT.
app.use(requireAuth);
