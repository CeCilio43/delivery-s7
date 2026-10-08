# customer-app

The customers' frontend: browse restaurants, fill a cart, place orders and
follow them live. It talks only to the api-gateway.

## Running it

Requires Node `^20.19.0 || >=22.12.0` (Vite 8, Vitest and oxlint need it).

```sh
cp .env.example .env   # VITE_API_GATEWAY_URL, defaults to http://localhost:3000
npm install
npm run dev            # http://localhost:5173 (restaurant-app uses 5174)
```

Sign in with a seeded customer, e.g. `jamie@example.com` / `password123`.

## Scripts

| Script               | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Vite dev server on port 5173              |
| `npm run build`      | Typecheck and build into `dist/`          |
| `npm run lint`       | oxlint                                    |
| `npm test`           | Vitest + React Testing Library, once      |
| `npm run test:watch` | Vitest in watch mode                      |

## Structure

```
src/
  api/         axios client for the gateway (adds the JWT) and one module per resource
  components/  shared UI (Button, AppNav, OrderStatusBadge, ...)
  context/     Auth (signed-in user), Cart (per-user, in localStorage),
               Notification (websocket for live order updates + toasts)
  hooks/       usePolling: fallback while the websocket is down
  lib/         token decoding, formatting helpers
  pages/       one component per route
  test/        Vitest setup and helpers (makeToken, renderWithProviders,
               mockGet, a FakeWebSocket to push order updates)
```

Tests sit next to the code they cover (`*.test.ts(x)`).

## Docker

`Dockerfile` builds the app and serves it with nginx; `nginx.conf` falls back
to `index.html` so client-side routes survive a refresh. CI
(`.github/workflows/customer-app.yml`) lints, tests and builds on every PR,
and pushes the image to GHCR on `main`.
