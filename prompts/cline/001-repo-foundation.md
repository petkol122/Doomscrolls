# Cline Task 001 — Repository Foundation

You are working on Doomscrolls, a production-minded browser-first online 2D isometric ARPG.

Your task is to create or verify the repository foundation only.

Do not implement gameplay.

Do not implement auth.

Do not implement Phaser scenes beyond minimal placeholders.

Do not implement server gameplay rooms.

Do not invent features.

Read these first:

```text
README.md
AGENTS.md
docs/ARCHITECTURE.md
docs/GAME_DESIGN.md
docs/BACKLOG_CORE_0_1.md
docs/CODING_RULES.md
```

## Goal

Ensure the monorepo foundation exists and passes basic checks.

## Expected structure

```text
apps/client
apps/server
packages/shared
packages/content
infra/compose
infra/docker
infra/migrations
infra/scripts
docs
.github/workflows
prompts/cline
```

## Required root scripts

```json
{
  "dev": "pnpm -r dev",
  "build": "pnpm -r build",
  "typecheck": "pnpm -r typecheck",
  "lint": "pnpm -r lint",
  "test": "pnpm -r test"
}
```

## Acceptance criteria

- `pnpm install` works.
- `pnpm lint` works.
- `pnpm typecheck` works.
- `pnpm test` works.
- `pnpm build` works.
- CI workflow exists.
- PR template exists.
- Docs exist.
- No gameplay is implemented.
- No auth is implemented.
- No fake systems are implemented.
- No real secrets are committed.

## Final report

After completing the task, report:

1. summary of changed files
2. commands run
3. assumptions
4. tech debt
5. confirmation that no gameplay/auth/fake systems were implemented
