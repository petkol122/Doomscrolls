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
cp infra/compose/.env.example infra/compose/.env
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env ps
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env logs postgres
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env logs redis
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env down
```

---

## Server Runtime Dependency

The server foundation in `apps/server` requires Redis to be reachable through `REDIS_URL` during startup. With the committed examples, use:

```bash
cp .env.example .env
cp infra/compose/.env.example infra/compose/.env
docker compose -f infra/compose/docker-compose.local.yml --env-file infra/compose/.env up -d
pnpm --filter @doomscrolls/server dev
curl http://localhost:2567/health
```

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
