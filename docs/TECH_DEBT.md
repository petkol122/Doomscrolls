# docs/TECH_DEBT.md

Track all known shortcuts and debt here.

Undocumented shortcuts are not allowed.

## Template

```text
Date:
Area:
Description:
Reason:
Risk:
Planned fix:
Status:
```

## Entries

Known tech debt is listed below.

## Prisma version pinned below latest major

```text
Date: 2026-06-02
Area: Database tooling
Description: apps/server uses Prisma 6.x because Prisma 7.x requires Node.js 20.19+, 22.12+ or 24.0+, while the current local environment is still on Node 19.x.
Reason: Keep the Prisma schema foundation working with the current project machine without changing the Node runtime baseline inside this task.
Risk: The project may lag behind the latest Prisma major until Node is standardized on a supported LTS version.
Planned fix: Standardize the repository on a supported Node LTS version, then evaluate upgrading Prisma to the latest major in a dedicated tooling task.
Status: Open
```

## Server lint tooling

```text
Date: 2026-06-02
Area: Server tooling
Description: apps/server has a real TypeScript typecheck/build/test command, but its lint script remains a placeholder because the repository-wide ESLint configuration is still not implemented.
Reason: Keep server foundation focused on runtime infrastructure without introducing partial lint configuration that diverges from the monorepo.
Risk: Server style issues are currently caught by TypeScript and review rather than ESLint automation.
Planned fix: Add shared ESLint configuration and replace package placeholder lint scripts in a dedicated tooling task.
Status: Open
```

## Colyseus peer dependency warning

```text
Date: 2026-06-02
Area: Server realtime tooling
Description: Installing Colyseus 0.17.x reports an unmet optional peer warning for vite >=6 while the client is pinned to Vite 5 due the local Node version constraint.
Reason: The server uses Colyseus runtime APIs only; the warning comes from Colyseus bundled tooling/playground integration rather than current server gameplay code.
Risk: Future Colyseus tooling integrations may require resolving the Vite version mismatch.
Planned fix: Standardize on a supported Node LTS version, revisit the Vite upgrade, and re-check Colyseus peer dependencies when room tooling is introduced.
Status: Open
```

## Localization test tooling

```text
Date: 2026-06-02
Area: Localization
Description: packages/localization exposes a typecheck-safe validation helper, but does not include dedicated unit tests because the repository test runner is still placeholder-only.
Reason: Avoid introducing new test infrastructure before the repo-wide testing approach is established.
Risk: Resolver behavior is currently verified by TypeScript checks and package validation shape rather than automated assertions.
Planned fix: Add real localization unit tests when the project introduces a real test runner.
Status: Open
```

## Content test tooling

```text
Date: 2026-06-02
Area: Content
Description: packages/content exposes validation and uses typecheck/build as its package test, but does not include dedicated unit tests because the repository test runner is still placeholder-only.
Reason: Avoid introducing a new test framework before the repo-wide testing approach is established.
Risk: Validation behavior is currently verified by TypeScript checks and direct validation calls rather than a formal unit test suite.
Planned fix: Add focused content validation unit tests when the project introduces a real test runner.
Status: Open
```

## Workspace alias resolution without install

```text
Date: 2026-06-02
Area: Tooling
Description: packages/content/tsconfig.json includes local path mappings to @doomscrolls/shared and @doomscrolls/localization so content can typecheck in a checkout where node_modules/workspace links are missing.
Reason: The current environment has no node_modules installed, but package checks still need to resolve workspace source imports.
Risk: Path mappings may need to be consolidated into the root tsconfig when more packages begin importing workspace aliases.
Planned fix: Move shared workspace path aliases to tsconfig.base.json or another central project reference setup once the monorepo build strategy matures.
Status: Open
```

Area: Client tooling
Description: Vite is pinned to ^5.4.21 because local machine uses Node 19.4.0.
Risk: Project may lag behind current Vite versions and CI/runtime may diverge.
Planned fix: Standardize project Node version on an LTS release using .nvmrc/Volta, then revisit Vite upgrade.

## Auth service transaction support

```text
Date: 2026-06-02
Area: Auth domain service
Description: AuthService.register() creates user + profile + settings + session records sequentially without a shared Prisma transaction. If a later step fails, earlier records may remain orphaned.
Reason: Current repositories do not support a shared transaction client. Implementing transaction support requires refactoring repositories to accept a transaction client parameter.
Risk: Partial user records could be created if a later step fails during registration.
Planned fix: Refactor repositories to accept a shared transaction client and wrap registration in a Prisma transaction.
Status: Resolved in Task 010A — AuthService.register() now wraps user/profile/settings/session creation in a single Prisma $transaction. Repositories already accepted Prisma.TransactionClient. PrismaDatabaseClient type was updated to reflect the union.
```

## Auth HTTP routes runtime test blocked by Node 19.x

```text
Date: 2026-06-02
Area: Server / Auth HTTP routes
Description: Auth HTTP routes (POST /auth/register, POST /auth/login, GET /me) are implemented and typecheck successfully, but cannot be manually verified at runtime because Fastify 5.x and Colyseus 0.17.x require Node.js 20+ (diagnostics.tracingChannel API and import assertions). The current local environment runs Node 19.x.
Reason: Local development environment has not been standardized on a supported Node LTS version yet.
Risk: Auth route behavior is verified by TypeScript compilation only, not by live HTTP requests against local Postgres/Redis.
Planned fix: Standardize project Node version on a supported LTS (20.x or 22.x) using .nvmrc/Volta, then perform live HTTP verification of auth routes.
Status: Open
```
