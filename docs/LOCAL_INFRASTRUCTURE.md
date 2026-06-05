# docs/LOCAL_INFRASTRUCTURE.md — Local Infrastructure

## Purpose

This document describes the local-only Docker Compose infrastructure for Doomscrolls development.

Task 005 provides PostgreSQL and Redis for server, Prisma, auth, persistence and room work. The local infrastructure itself does not implement auth endpoints, server rooms, gameplay systems or production deployment.

---

## Services

### PostgreSQL

```text
service: postgres
image: postgres:16-alpine
database: doomscrolls
user: doomscrolls
port: 5432
```

PostgreSQL uses a named Docker volume named `postgres_data` so local development data survives container restarts and `docker compose down`.

The local password in `.env.example` is a development placeholder only. Do not reuse it for staging or production.

Healthcheck:

```text
pg_isready
```

### Redis

```text
service: redis
image: redis:7-alpine
port: 6379
```

Redis does not use a volume in the local Compose file. For Core 0.1 local development, Redis is treated as cache/presence/realtime support rather than persistent truth. Persistent game/account data belongs in PostgreSQL.

Healthcheck:

```text
redis-cli ping
```

---

## Environment File

Create a local environment file from the committed example:

```bash
cp infra/compose/.env.example infra/compose/.env
```

Example values:

```env
POSTGRES_DB=doomscrolls
POSTGRES_USER=doomscrolls
POSTGRES_PASSWORD=doomscrolls
POSTGRES_PORT=5432
REDIS_PORT=6379
```

`infra/compose/.env` is ignored by Git and must not be committed. `infra/compose/.env.example` is safe to commit because it contains local placeholder values only.

---

## Commands

Start local infrastructure:

```bash
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
```

Inspect service status and health:

```bash
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env ps
```

View PostgreSQL logs:

```bash
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env logs postgres
```

View Redis logs:

```bash
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env logs redis
```

Stop local infrastructure:

```bash
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env down
```

---

## Full Local Setup Flow

```bash
copy infra\compose\.env.example infra\compose\.env
copy apps\server\.env.example apps\server\.env
copy apps\client\.env.example apps\client\.env
pnpm dev:all
```

`pnpm dev:all` is the simplest local startup path. It first runs:

```bash
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
```

and then starts both `pnpm dev:server` and `pnpm dev:client` together with visible prefixed logs via `concurrently`. This is local development orchestration only; it does not add production deployment containers or production process management.

Local URLs after startup:

```text
backend health: http://localhost:2567/health
client:         http://localhost:5173
```

You can still inspect or stop the local infrastructure separately with:

```bash
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env ps
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env logs postgres
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env logs redis
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env down
```

---

## Server Runtime Dependency

The server foundation in `apps/server` requires Redis to be reachable through `REDIS_URL` during startup. With the committed examples, use:

```bash
copy infra\compose\.env.example infra\compose\.env
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
copy apps\server\.env.example apps\server\.env
pnpm dev:server
curl http://localhost:2567/health
```

`pnpm dev:server` runs `@doomscrolls/server` in watch mode. The server package loads `apps/server/.env` through `dotenv/config`, listens on `http://localhost:2567` with the example values, and exposes `GET /health` for local verification.

## Client Runtime Dependency

Run the browser client against the local server with:

```bash
copy apps\client\.env.example apps\client\.env
pnpm --filter @doomscrolls/client dev -- --host 0.0.0.0
```

`apps/client/.env.example` includes Tailscale-ready local-dev URLs:

```env
VITE_API_URL=http://100.101.190.70:2567
VITE_WS_URL=ws://100.101.190.70:2567
```

The Vite dev server binds to `0.0.0.0`, so you can use `http://localhost:5173` on the dev machine or `http://100.101.190.70:5173` from another Tailscale-connected device. If the server is accessed from the Tailscale client URL, set `CLIENT_ORIGIN_EXTRA=http://100.101.190.70:5173` in `apps/server/.env` so local-dev CORS allows that extra origin without changing production origins.

`DATABASE_URL` is required for Prisma CLI commands and future runtime persistence. The Prisma schema foundation exists in `apps/server/prisma/schema.prisma`, but the current server runtime does not connect to PostgreSQL or run database queries on startup.

---

## Scope Boundaries

This infrastructure is intentionally local-only.

It does not add:

- auth endpoints
- auth/profile/character Fastify routes
- Colyseus gameplay rooms
- gameplay simulation
- fake server/client containers
- production deployment
- cloud infrastructure
