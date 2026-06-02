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

## Final Rule

If a feature only appears to work, it is not done.

If it cannot survive refresh/reconnect where persistence is required, it is not done.

If it trusts the client for gameplay outcome, it is not done.

If it hardcodes content into systems, it is not done.

If it breaks CI, it is not done.
