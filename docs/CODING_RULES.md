# docs/CODING_RULES.md — Doomscrolls Coding Rules

## Development Mode

Doomscrolls may be developed with AI-assisted coding, including Cline, ChatGPT, Claude or other coding agents, but the codebase must remain maintainable, scalable and production-minded.

---

## Task Behavior

Tasks that affect architecture, database schema, auth/session model, network protocol, room lifecycle, combat authority, inventory persistence, deployment, security or shared contracts require a plan first.

Small contained tasks may be coded directly, but the final report must explain what changed and how it was verified.

---

## TypeScript

Use strict TypeScript.

Avoid `any`. Prefer `unknown` and validate it.

Shared types belong in `packages/shared`.

Content definitions belong in `packages/content`.

---

## Prisma

Doomscrolls uses PostgreSQL + Prisma.

Rules:

- schema changes require Prisma migrations
- migrations must be committed
- normal application logic uses Prisma repositories/services
- do not introduce another ORM
- do not use raw SQL unless explicitly justified
- do not use `prisma db push` as the normal committed workflow

---

## Server Authority

The client sends intent. The server decides outcomes.

Forbidden client authority:

```text
damage
kills
XP
loot
inventory ownership
equipment state
corpse recovery
level-up
quest completion
```

---

## Testing

Tests are required from the beginning.

Minimum required checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Core test areas:

```text
content validation
auth
settings validation
origin/class validation
character creation
damage calculation
inventory placement
loot generation
corpse recovery
```

---

## Documentation

Update docs when changing:

```text
architecture
setup
auth behavior
database schema
content model
gameplay rules
task status
known limitations
deployment
testing commands
```

Known shortcuts must be recorded in `docs/TECH_DEBT.md`.

---

## Localization

English is the source/default language.

Core 0.1 supports only the `en` locale in code. Do not add language settings, a language selector or inactive locale codes until real locale files exist.

User-facing text should use localization keys from `packages/localization` instead of hardcoded strings. Missing keys must fail visibly, for example with a `[missing:key]` fallback, and must not silently return an empty string.

---

## Content Registry

Core content definitions belong in `packages/content` as modular data files.

Rules:

- gameplay systems must consume `contentRegistry` definitions instead of hardcoding content values
- content definitions must use localization keys for player-facing names and descriptions
- cross-references must be validated with `validateContentRegistry` or `assertValidContentRegistry`
- missing content lookups must not silently return fake fallback content
- loot tables define weighted entries only; random loot rolling belongs in a later server-authoritative loot system
- content data must not import Phaser, Prisma, Fastify, Colyseus, Redis, PostgreSQL or Node-only runtime APIs

---

## Final Rule

If a feature only appears to work, it is not done.

If it cannot survive refresh/reconnect where persistence is required, it is not done.

If it trusts the client for gameplay outcome, it is not done.

If it hardcodes content into systems, it is not done.

If it breaks CI, it is not done.
