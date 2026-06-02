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
