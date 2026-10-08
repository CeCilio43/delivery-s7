# delivery-s7

## Backend

The backend is C# (.NET 10): five microservices and an api-gateway that talk over
RabbitMQ and each own a Postgres database.

| Folder | Port |
|---|---|
| `gateway/api-gateway` (YARP reverse proxy, JWT check, Swagger UI at `/docs`) | 3000 |
| `services/user-service` | 3001 |
| `services/restaurant-service` | 3002 |
| `services/order-service` | 3003 |
| `services/payment-service` | 3004 |
| `services/notification-service` (websocket) | 3005 |

Shared code lives in `libs/Delivery.Common` (event bus, event contracts, database
plumbing); the event payloads are documented in `libs/events`.

### Run everything

```sh
docker compose -f infra/docker-compose.yml up --build
```

Each service applies its database migrations on startup.

### Seed development data

With the stack running, seed each database (all seeded users have password `password123`):

```sh
docker compose -f infra/docker-compose.yml run --rm user-service seed
docker compose -f infra/docker-compose.yml run --rm restaurant-service seed
docker compose -f infra/docker-compose.yml run --rm order-service seed
docker compose -f infra/docker-compose.yml run --rm payment-service seed
```

Outside Docker, `dotnet run --project services/user-service/src -- seed` does the same
(the service reads `DATABASE_URL` and friends from its `.env`).

### Test

```sh
dotnet test delivery-s7.sln
```

Tests run against in-memory SQLite and a fake event bus, so they need no Postgres or RabbitMQ.

### Migrations

Migrations are plain SQL under `<service>/src/Migrations/<timestamp>_<name>/migration.sql`.
Add a new folder with a later timestamp to change a schema; applied migrations are
recorded in the `_prisma_migrations` table (kept from when the services used Prisma).
