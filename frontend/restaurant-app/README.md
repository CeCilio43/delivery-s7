# restaurant-app

The restaurant owners' frontend: owners sign in and (soon) manage the orders
for their restaurant. It talks only to the api-gateway, like customer-app.

To tell the two apps apart at a glance, this one uses light-grey surfaces on
a darker grey page (customer-app uses white) and shows a "Restaurant" label.

## Running it

Requires Node `^20.19.0 || >=22.12.0` (Vite 8, Vitest and oxlint need it).

```sh
cp .env.example .env   # VITE_API_GATEWAY_URL, defaults to http://localhost:3000
npm install
npm run dev            # http://localhost:5174 (customer-app uses 5173)
```

The gateway must allow this origin; its `FRONTEND_URLS` includes
`http://localhost:5174` by default.

Sign in with a seeded owner, e.g. `sam@mariospizzeria.com` / `password123`.
Only `RESTAURANT_OWNER` accounts get in; customer accounts are refused.

## Scripts

| Script               | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Vite dev server on port 5174              |
| `npm run build`      | Typecheck and build into `dist/`          |
| `npm run lint`       | oxlint                                    |
| `npm test`           | Vitest + React Testing Library, once      |
| `npm run test:watch` | Vitest in watch mode                      |

## Structure

```
src/
  api/         axios client for the gateway (adds the JWT)
  components/  shared UI (Button, TextField, AppNav, ProtectedRoute, ...)
  context/     AuthContext: the signed-in owner, from the stored JWT
  lib/         token storage and decoding
  pages/       one component per route (Login, Orders)
  test/        Vitest setup and helpers (makeToken, renderWithProviders)
```

Tests sit next to the code they cover (`*.test.ts(x)`).

## Docker

`Dockerfile` builds the app and serves it with nginx; `nginx.conf` falls back
to `index.html` so client-side routes survive a refresh. CI
(`.github/workflows/restaurant-app.yml`) lints, tests and builds on every PR,
and pushes the image to GHCR on `main`.
