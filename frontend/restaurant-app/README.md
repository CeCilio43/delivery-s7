# restaurant-app

The restaurant owners' frontend. It talks only to the api-gateway (its
`/owner/...` routes), like customer-app. Owners can:

- work through paid orders on a live board: accept (preparing), mark ready,
  or reject with a reason (the customer is refunded)
- see new orders and cancellations the moment they happen (websocket push,
  with polling as a fallback)
- open or close the restaurant for new orders
- manage the menu: add, edit, reprice, mark (un)available, delete
- edit the restaurant's details, and register more restaurants

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
  api/         axios client for the gateway (adds the JWT); restaurants, orders
  components/  shared UI (AppNav, OpenToggle, OrderCard, MenuItemForm, Page, ...)
  context/     Auth (signed-in owner), Restaurant (their restaurants and which
               one is selected), Notification (websocket + toasts)
  hooks/       usePolling: fallback while the websocket is down
  lib/         token decoding, formatting helpers
  pages/       one component per route (Login, Orders, Menu,
               RestaurantSettings, NewRestaurant)
  test/        Vitest setup and helpers (makeToken, renderWithProviders,
               mockApi, a FakeWebSocket to push order updates)
```

Tests sit next to the code they cover (`*.test.ts(x)`).

## Docker

`Dockerfile` builds the app and serves it with nginx; `nginx.conf` falls back
to `index.html` so client-side routes survive a refresh. CI
(`.github/workflows/restaurant-app.yml`) lints, tests and builds on every PR,
and pushes the image to GHCR on `main`.
