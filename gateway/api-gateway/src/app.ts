import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import { requireAuth, requireRole } from './middleware/requireAuth';
import { openApiSpec } from './openapi';

export const app = express();

// The frontends run on other origins (customer-app on 5173, restaurant-app
// on 5174 in development) and send an Authorization header on protected
// requests, both of which trigger a CORS preflight that the browser blocks
// without this. FRONTEND_URLS is a comma-separated list of allowed origins.
const FRONTEND_URLS = (process.env.FRONTEND_URLS ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
app.use(cors({ origin: FRONTEND_URLS }));

// Downstream services trust these headers to identify the caller, so a
// client must never be able to set them; only the protected proxies below
// re-add them, from the verified JWT.
app.use((req, _res, next) => {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-role'];
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// Swagger UI for trying out every route the gateway exposes. Served from the
// gateway itself so "Try it out" requests are same-origin and go through the
// exact same proxying and auth as the customer-app's.
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  swaggerOptions: { persistAuthorization: true },
}));

const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL ?? 'http://localhost:3002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:3003';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3004';

// Auth routes are unauthenticated by design and proxy straight through to
// user-service, so they're mounted ahead of the requireAuth gate below.
// pathFilter matches on prefix, so '/register' also covers
// '/register/restaurant-owner' (restaurant-app's sign-up).
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

// The notification websocket (/ws/notifications) isn't routed here: Express
// never sees "upgrade" requests. See websocket.ts, wired up in index.ts.

// Everything mounted after this point requires a valid JWT.
app.use(requireAuth);

// Proxies to a service that needs to know who the caller is. The verified
// JWT's claims are forwarded as x-user-id / x-user-role, so services don't
// each need the JWT secret.
function authenticatedProxy(target: string, pathFilter: string[]) {
  return createProxyMiddleware<Request, Response>({
    target,
    changeOrigin: true,
    pathFilter,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.sub);
          proxyReq.setHeader('x-user-role', req.user.role);
        }
      },
    },
  });
}

app.use(authenticatedProxy(ORDER_SERVICE_URL, ['/orders']));
app.use(authenticatedProxy(PAYMENT_SERVICE_URL, ['/payments']));

// The restaurant-owner area. This is only the coarse role gate; the services
// behind it still check that each restaurant or order belongs to the owner.
app.use('/owner', requireRole('RESTAURANT_OWNER'));
app.use(authenticatedProxy(RESTAURANT_SERVICE_URL, ['/owner/restaurants']));
app.use(authenticatedProxy(ORDER_SERVICE_URL, ['/owner/orders']));
