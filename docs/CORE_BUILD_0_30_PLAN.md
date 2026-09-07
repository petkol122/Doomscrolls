# docs/CORE_BUILD_0_30_PLAN.md — Core Build 0.30 Plan

## Status

**Retroactively documented.** This build's implementation already existed, complete and uncommitted, in the working tree — authored in a prior, undocumented session, and only identified during the Core 0.24-0.29 commit-splitting pass (this session, 2026-09-07), when it surfaced as an unrelated diff mixed into two files (`packages/content/src/ContentValidation.ts`, `packages/localization/src/locales/en.ts`) that also carried real 0.26/0.29 changes. It was deliberately excluded from every 0.24-0.29 commit and left sitting in the working tree, flagged as out of scope. This document reconstructs the plan a real planning pass would have produced, from the actual diff against `aad6683` (the `0.29` commit — the state of every 0.24-0.29 build once committed) and the feature's own code comments, which already explain their reasoning.

Nothing here changes what was implemented — it gives it the identity and record every other build in this repo has, and "0.30" is a label, not a claim about chronological position (this project already has precedent for that: 0.10-0.12 landed as one combined commit despite being three builds).

---

## Core 0.30 Theme

**Lore Content Foundation** — a new, self-contained content category (`packages/content/src/data/lore.ts`) of extended flavor text, keyed to existing origin/class/zone/enemy content IDs, plus registry wiring and validation. Data-layer only: the lore entries exist, validate, and are queryable through `ContentRegistry.lore`, but nothing renders them anywhere yet. The feature's own doc comment says so directly: "Not wired into any UI yet; that's a future decision once there's enough lore to justify a surface for it."

---

## How This Build Was Found

- File mtimes for `packages/content/src/data/lore.ts`, `packages/content/src/ContentRegistry.ts`, and `packages/content/src/index.ts` cluster tightly at `2026-09-06 23:30:44` – `23:32:10` — after 0.27/0.28's own dated work (`2026-09-06`) and before 0.29's (`2026-09-07`), placing authorship in a gap between those sessions. (`ContentValidation.ts` and `en.ts`'s own mtimes are not usable evidence for this — both were touched again during this session's commit-splitting work, which disturbs mtimes without changing content; their lore-related hunks are confirmed to be the same age by content match, not by timestamp.)
- No plan, checklist, or release notes existed anywhere in `docs/` for it, and it matched no build's documented file footprint from 0.4 (the only earlier build whose docs mention "lore" at all, and only as an explicit non-goal: "no ... lore pages ... were introduced") through 0.29.
- Confirmed via `git diff aad6683 -- packages/content/src/ContentValidation.ts packages/localization/src/locales/en.ts` (before this session's split) that the lore-related hunks in those two files are real, additional, self-contained work — not accidental noise from an unrelated edit.
- Full suite (`pnpm --filter @doomscrolls/server test`, `pnpm -r typecheck`) already passes with this content active in the tree, confirming it is valid, working code, not a broken draft.

---

## What Changed

### New content category (`packages/content/src/data/lore.ts`)

- `LoreEntryBase` (`id`, `titleKey`, `bodyKey` — both keys typed `ContentLocalizationKey`, i.e. `keyof typeof en`, so a typo fails at compile time) plus four `targetKind`-discriminated variants: `ClassLoreEntryDefinition` (`targetId: CharacterClassKey`), `OriginLoreEntryDefinition` (`targetId: OriginKey`), `ZoneLoreEntryDefinition` (`targetId: ZoneContentId`), `EnemyLoreEntryDefinition` (`targetId: EnemyId`) — unioned as `LoreEntryContentDefinition`.
- 12 authored entries, `as const satisfies readonly LoreEntryContentDefinition[]`: 1 origin (`sewer_dweller`), 2 classes (`gravewalker`, `ironclad`), 5 zones (`nightmarket`, `blackwire_sewers`, `static_yard`, `cinderworks`, `saltmere_docks` — every zone in the game), 4 enemies (`trashboar_brute`, `foundry_warden`, `arc_sentinel`, `drowned_hauler` — the zone-anchor/heavy enemies from 0.16-0.19's content). Every `targetId` is a real, pre-existing content ID; no new origins/classes/zones/enemies were introduced.

### Registry wiring (`ContentRegistry.ts`, `index.ts`)

- `ContentRegistryInput.lore: readonly LoreEntryContentDefinition[]`, `ContentRegistry.lore: ContentCollection<LoreEntryContentDefinition>` (built via the same `createCollection("lore", input.lore)` every other category uses), and the top-level `contentRegistry` instantiation passes `lore` through — the identical pattern every other content category already follows, no new abstraction introduced.
- `index.ts` re-exports `lore` and the five new types (`LoreEntryContentDefinition`, `ClassLoreEntryDefinition`, `OriginLoreEntryDefinition`, `ZoneLoreEntryDefinition`, `EnemyLoreEntryDefinition`).

### Localization (`packages/localization/src/locales/en.ts`)

- 24 new keys (`lore.<entry_id>.title` / `lore.<entry_id>.body`, one pair per entry), each a short title and a paragraph of prose, in-voice with the project's existing tone (dry, working-class-grim, matching the existing zone/enemy description strings).

### Validation (`ContentValidation.ts`)

- `validateUniqueIds("lore", registry.lore.all, errors)` — the same generic id-uniqueness check every category gets.
- A dedicated "Lore validation" block, the one part of this build genuinely custom to lore rather than a copy of the generic pattern: for every entry, confirms `en[entry.titleKey]`/`en[entry.bodyKey]` both resolve to a real localization key, then switches on `targetKind` to confirm `targetId` resolves to a real id in the matching registry collection (`classes`/`origins`/`zones`/`enemies`) — so "prose lore can't silently drift out of sync with content the way it has in design docs" (the block's own comment).

---

## Verification Strategy

- `pnpm --filter @doomscrolls/server test` — `test/content/contentRegistryValidation.test.ts` already exercises `validateContentRegistry` against the real registry, including this content; passing confirms every lore entry's `targetId` resolves and every `titleKey`/`bodyKey` exists in `en.ts`, not just that the file compiles.
- `pnpm -r typecheck` — confirms the `ContentLocalizationKey` (`keyof typeof en`) constraint on `titleKey`/`bodyKey` is satisfied at compile time for all 12 entries, and that the `targetId` fields all satisfy their respective real content-ID types.

No new test file is added specifically for lore — the existing content-registry validation test already covers exactly the properties that matter here (uniqueness, key/id resolution), and lore introduces no new runtime code path (no room handler, no client rendering) that would need its own dedicated test.

---

## Core 0.30 Non-Goals

```text
no UI surface for lore of any kind -- not wired into any panel, tooltip, or screen; stated explicitly in the feature's own doc comment as a deliberate future decision, not an oversight
no lore for content added after this build (no per-item lore, no per-skill lore); only origin/class/zone/enemy are covered
no localization beyond English -- en.ts is the only locale file in this repo
no lore unlock/discovery mechanic, no gating on player progress -- every entry is static, authored content with no runtime state
```

---

## Summary

Core Build 0.30 adds a small, self-contained, purely additive content category: 12 pieces of flavor text for existing origins/classes/zones/enemies, validated the same way every other content category is (unique ids, resolved localization keys, and — the one custom piece — resolved target ids scoped by kind), with zero UI surface and zero new runtime code path. It was implemented and verified in a prior, undocumented session and surfaced only because it happened to share two files with real 0.26/0.29 work being split into commits; this document — along with `docs/CORE_BUILD_0_30_CHECKLIST.md` and `docs/CORE_BUILD_0_30_RELEASE_NOTES.md` — gives it the same record every other build in this repo has.
