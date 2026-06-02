# Doomscrolls

**Doomscrolls** is a browser-first and mobile-ready online 2D isometric ARPG.

The game is inspired by Diablo 2 pacing, loot, atmosphere and click-to-move combat, but it is set in a modern dark-fantasy world starting in the Czech Republic.

This repository is not a throwaway prototype. It is a production-minded foundation for a small but real online game.

---

## Current Milestone

```text
Core Build 0.1
```

Core Build 0.1 goal:

```text
register account
login
create profile/settings
create character
enter hub
enter combat zone
move
attack
kill enemy
gain XP
drop loot
pick up loot
persist inventory
corpse death/respawn foundation
disconnect/reconnect
continue with saved state
```

No fake mechanics. No client-only gameplay outcomes. No hardcoded game content inside systems.

---

## Game Summary

- **Genre:** Online 2D isometric ARPG
- **Platforms:** Web first, Android/iOS through Capacitor later
- **Combat:** Diablo 2-like click-to-move and click-to-attack
- **World:** Earth, starting in the Czech Republic
- **Tone:** Modern dark fantasy with dry black humor
- **Main antagonistic force:** Moloch
- **Architecture:** server-authoritative, room-based, data-driven

---

## Core 0.1 Locked Content

- First Origin: **Sewer Dweller**
- First Passive: **Nightvision**
- First Class: **Gravewalker**
- First Hub: **The Nightmarket**
- First Combat Zone: **Blackwire Sewers**
- First Enemy: **Trashboar Runt**

---

## Technology Stack

### Client

```text
Phaser
TypeScript
Vite
```

### Server

```text
Node.js
TypeScript
Colyseus
Fastify
```

### Database

```text
PostgreSQL
Prisma ORM
Prisma Client
Prisma Migrate
```

### Realtime / Cache

```text
Redis
```

### Infrastructure

```text
Docker
Docker Compose
GitHub
GitHub Actions
```

---

## Development Setup

Requirements:

```text
Node.js
pnpm
Docker
Docker Compose
Git
```

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Exact commands may evolve as the repository is implemented. If commands change, update this README.

---

## Repository Structure

```text
doomscrolls/
  apps/
    client/
    server/
  packages/
    shared/
    content/
  infra/
    compose/
    docker/
    migrations/
    scripts/
  docs/
  prompts/
  .github/
```

---

## Required Reading Before Coding

Read these before implementing tasks:

```text
AGENTS.md
docs/ARCHITECTURE.md
docs/GAME_DESIGN.md
docs/BACKLOG_CORE_0_1.md
docs/CODING_RULES.md
```

---

## Current Priority

Do not start with combat or graphics.

Start with foundation:

```text
repo
workspace
CI
shared types
content registry
local infrastructure
Prisma schema
auth
profile
settings
character creation
```

Only then implement rooms, movement, combat, loot, inventory and corpse/death.
