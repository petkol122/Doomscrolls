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
