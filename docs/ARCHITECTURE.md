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

Core 0.1 schema foundation:

```text
User
Session
UserProfile
UserSettings
Character
CharacterStats
CharacterPassive
Inventory
ItemInstance
Corpse
```

The schema stores content references such as origins, classes, passives, zones, equipment slots and item definitions as content IDs. These are not database relations because gameplay content remains data-driven in `packages/content`.

Rules:

- all schema changes require Prisma migration files
- migrations must be committed
- use `pnpm --filter @doomscrolls/server prisma:migrate:dev` during development
- use `pnpm --filter @doomscrolls/server prisma:migrate:deploy` in staging/production
- do not manually edit production schema
- do not use raw SQL unless explicitly justified
- keep Prisma usage behind repositories/services where practical
- do not return `passwordHash` to clients in future auth/profile work

Current Prisma scripts:

```text
pnpm --filter @doomscrolls/server prisma:generate
pnpm --filter @doomscrolls/server prisma:migrate:dev
pnpm --filter @doomscrolls/server prisma:migrate:deploy
pnpm --filter @doomscrolls/server prisma:studio
```

`apps/server/src/persistence/prisma.ts` provides a minimal Prisma Client bootstrap. Repository classes, auth endpoints and persistence business logic are deferred to later Core 0.1 tasks.

Local development infrastructure for PostgreSQL is defined in:

```text
infra/compose/docker-compose.local.yml
```

The local `postgres` service uses `postgres:16-alpine`, a named Docker volume and a healthcheck. Development migrations should be generated against this local PostgreSQL service with Prisma Migrate; do not use `prisma db push` as the committed workflow.

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

The Prisma schema foundation exists, and the server validates `DATABASE_URL` so configuration is explicit. The current runtime still does not execute database queries on startup and does not implement auth endpoints, repository classes, room persistence, inventory logic, corpse recovery logic or gameplay business logic.

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
