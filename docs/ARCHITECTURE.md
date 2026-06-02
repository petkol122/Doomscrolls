# docs/ARCHITECTURE.md — Doomscrolls Technical Architecture

## Purpose

This document defines the technical architecture of Doomscrolls.

Doomscrolls is a browser-first and mobile-ready online 2D isometric ARPG with Diablo 2-like pacing, server-authoritative multiplayer, persistent characters, loot, progression, profiles, settings and scalable room-based world architecture.

---

## Architecture Summary

```text
Web / Android / iOS Client
        |
        | HTTPS REST
        | WebSocket
        v
Node.js / Fastify / Colyseus Server
        |
        |------------------|
        v                  v
PostgreSQL + Prisma       Redis
Persistent truth          Presence/cache/realtime support
```

---

## Principles

### Server authority

The client sends intent. The server owns gameplay truth.

### Data-driven gameplay

Origins, classes, passives, skills, enemies, items, loot tables, zones and level tables must be content definitions, not hardcoded system logic.

### Room-based world

Doomscrolls scales by rooms and instances, not one giant global simulation.

Initial room types:

```text
TownRoom
CombatRoom
DungeonRoom later
BossRoom later
```

### No fake features

Placeholder art is allowed. Placeholder mechanics are not.

---

## Database Access Architecture

Doomscrolls uses:

```text
PostgreSQL
Prisma ORM
Prisma Client
Prisma Migrate
```

Prisma schema location:

```text
apps/server/prisma/schema.prisma
```

Migrations location:

```text
apps/server/prisma/migrations/
```

Rules:

- all schema changes require Prisma migration files
- migrations must be committed
- use `migrate dev` during development
- use `migrate deploy` in staging/production
- do not manually edit production schema
- do not use raw SQL unless explicitly justified
- keep Prisma usage behind repositories/services where practical

Local development infrastructure for PostgreSQL is defined in:

```text
infra/compose/docker-compose.local.yml
```

The local `postgres` service uses `postgres:16-alpine`, a named Docker volume and a healthcheck. The Compose stack is infrastructure only; it does not define Prisma schema, migrations or database models.

---

## Redis Architecture

Redis is planned for presence, cache and realtime coordination support.

Local development infrastructure for Redis is defined in:

```text
infra/compose/docker-compose.local.yml
```

The local `redis` service uses `redis:7-alpine` and a `redis-cli ping` healthcheck. Redis has no local volume by default because PostgreSQL remains the persistent source of truth for Core 0.1 account, character, inventory and progression data.

The first server foundation requires `REDIS_URL` and performs a Redis connect + `PING` check during startup. Startup fails if Redis is unavailable because Redis is required local infrastructure for realtime/cache/presence foundations.

---

## Server Foundation

The current server foundation lives in `apps/server` and provides:

```text
Fastify HTTP server
configured CORS from CLIENT_ORIGIN
structured Fastify logger with secret redaction
environment validation with zod
GET /health
content registry validation on startup
Redis connection check on startup
Colyseus server shell attached to the HTTP server
graceful SIGINT/SIGTERM shutdown
```

`GET /health` returns only a safe service payload and does not expose secrets or internal stack traces.

The Colyseus shell intentionally registers no rooms. `TownRoom`, `CombatRoom`, room authentication, movement, combat, enemy spawning, loot and gameplay messages are deferred to later Core 0.1 tasks.

PostgreSQL is still deferred to the Prisma task. The server validates `DATABASE_URL` so configuration is explicit, but it does not import Prisma, open PostgreSQL connections, define database models, run migrations or implement persistence yet.

---

## Core 0.1 Runtime Scope

Core 0.1 must support:

```text
register/login
profile/settings
character creation
room auth
TownRoom
CombatRoom
server-authoritative movement/combat
grid inventory
equipment
loot
XP
corpse death/respawn/recovery
reconnect
```

Deferred systems:

```text
guilds
friends
trading
crafting
PvP
procedural dungeons
Capacitor app
admin panel
```
