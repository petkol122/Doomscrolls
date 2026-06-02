# AGENTS.md — Doomscrolls Development Rules

## Project

**Doomscrolls** is a production-minded online 2D isometric ARPG.

The game is inspired by Diablo 2 pacing, loot, atmosphere and click-to-move combat, but it is set in a modern dark-fantasy world.

This is not a throwaway demo. This is a small real game built from day one with scalable architecture.

---

## Core Rule

Do not build fake features.

A feature is not complete unless it has real data flow, real server logic where required, persistence where required, validation, tests/checks and documentation.

Placeholder visuals are allowed. Placeholder mechanics are not.

---

## Final Technology Stack

### Client

- Phaser
- TypeScript
- Vite
- Browser-first
- Capacitor later for Android/iOS

### Server

- Node.js
- TypeScript
- Colyseus
- Fastify
- Server-authoritative rooms

### Database Layer

- PostgreSQL
- Prisma ORM
- Prisma Client
- Prisma Migrate

Prisma is the default database layer.

Agents must not introduce another ORM, query builder or raw SQL-heavy architecture without explicit approval.

### Realtime / Cache

- Redis

### Infrastructure

- Docker
- Docker Compose
- GitHub
- GitHub Actions CI
- Hetzner Cloud later
- Cloudflare/CDN later if needed

---

## Absolute Non-Negotiables

### Never trust the client

The client may send intent.

The server decides truth.

Client may send:

```text
MoveToPoint
AttackTarget
CastSkill
PickupLoot
UsePotion
UseBeltSlot
Interact
ChatMessage
UpdateSettings
```

Client must never send:

```text
I dealt damage
I killed this enemy
I gained XP
I found this item
I completed this quest
I changed my stats
I leveled up
```

### Never hardcode game content in systems

Bad:

```ts
if (enemy.name === "Trashboar Runt") {
  enemy.hp = 18;
}
```

Good:

```ts
const enemyDefinition = content.enemies.get("trashboar_runt");
```

Content must live in data files or content modules.

### No visual-only systems

Forbidden fake implementation examples:

- enemy dies visually but server does not track death
- loot appears but is not generated server-side
- inventory UI shows items that are not persisted
- character creation UI exists but does not create a database record
- settings UI exists but settings do not affect real behavior
- login screen exists but does not authenticate

---

## Core 0.1 Identity

- No guest accounts.
- Use username/password registration and login.
- Username is public, unique, visible and used for login.
- Display name is public, flexible and non-unique.
- Avatar uses `avatarKey` from predefined avatars; upload comes later.
- Character name is required and unique only within the owning account.

---

## Core 0.1 Game Scope

Included:

```text
username/password registration
login
profile
functional settings only: audio + FPS counter
character select/create
Sewer Dweller origin
Nightvision passive
Gravewalker class
The Nightmarket hub
Blackwire Sewers combat room
Trashboar Runt enemy
click-to-move
click-to-attack
grid inventory
equipment slots
item stat modifiers
starter healing flask
corpse death/respawn/recovery foundation
server-side XP
server-side loot
inventory/equipment persistence
basic reconnect
```

Excluded until later:

```text
guest login
Google login
email verification
password reset
full Czech Republic map
multiple countries
multiple origins/classes
quests
bosses
guilds
friends
trading
crafting
PvP
procedural dungeons
mobile app build
cosmetic shop
monetization
admin panel
```

---

## GitHub Workflow

Use branch + pull request workflow even when working solo.

Branch examples:

```text
feature/001-repo-foundation
feature/002-shared-types
feature/003-content-registry
feature/004-prisma-schema
```

Main branch should stay stable.

Every PR must include:

- summary
- changed files
- testing performed
- database migrations if any
- documentation updates if any
- known limitations / tech debt

---

## Definition of Done

A task is done only when:

- TypeScript compiles
- lint/typecheck/test/build pass
- server validates important input
- no fake systems are introduced
- no hardcoded gameplay content is introduced
- docs are updated if behavior/setup/architecture changed
- tech debt is documented if introduced
- CI passes

If a feature only appears to work, it is not done.
