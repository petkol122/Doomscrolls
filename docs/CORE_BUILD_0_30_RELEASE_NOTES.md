# docs/CORE_BUILD_0_30_RELEASE_NOTES.md — Core Build 0.30 Release Notes

---

## Task — Lore Content Foundation

**Date:** implemented in a prior, undocumented session; these notes written retroactively on 2026-09-07 during the Core 0.24-0.29 commit-splitting pass
**Build:** Core Build 0.30
**Status:** Implemented and verified. Was left uncommitted and undocumented for an unknown span of time before being identified and given this record.

### Summary

A new, small, self-contained content category: 12 pieces of extended flavor text ("lore"), each attached to an existing origin, class, zone, or enemy content ID. It's data-layer only — the entries exist, are validated the same rigorous way every other content category is, and are queryable through `ContentRegistry.lore` — but nothing renders them anywhere. The feature's own doc comment says so directly: "Not wired into any UI yet; that's a future decision once there's enough lore to justify a surface for it."

### How this release note came to exist

This build's implementation predates its own documentation. While splitting the Core 0.24-0.29 working tree into per-build commits (this session, 2026-09-07), two files needed for those builds — `packages/content/src/ContentValidation.ts` (real 0.26 work) and `packages/localization/src/locales/en.ts` (real 0.29 work) — turned out to also carry a completely separate, coherent diff that matched no build's documentation anywhere from Core 0.4 (the only earlier build whose docs mention "lore" at all, and only as an explicit non-goal) through 0.29. Tracing it further found the full feature: a new `packages/content/src/data/lore.ts` plus wiring in `ContentRegistry.ts`/`index.ts`, neither mentioned in any 0.24-0.29 release note. File mtimes (`lore.ts`/`ContentRegistry.ts`/`index.ts` cluster at `2026-09-06 23:30:44`–`23:32:10`) place its authorship after 0.27/0.28's own dated session and before 0.29's, in a gap between them. It was deliberately excluded from every 0.24-0.29 commit — flagged by name in the 0.26 and 0.29 commit messages — and is documented here in its own right, then committed on its own. See `docs/CORE_BUILD_0_30_PLAN.md` for the full reconstructed plan and `docs/CORE_BUILD_0_30_CHECKLIST.md` for the itemized checklist.

### What changed

- **`packages/content/src/data/lore.ts`** (new): `LoreEntryBase` (`id`, `titleKey`, `bodyKey`, both keys typed `ContentLocalizationKey` — i.e. `keyof typeof en`, so a typo'd key fails at compile time) plus four `targetKind`-discriminated variants (`ClassLoreEntryDefinition`, `OriginLoreEntryDefinition`, `ZoneLoreEntryDefinition`, `EnemyLoreEntryDefinition`), unioned as `LoreEntryContentDefinition`. 12 authored entries: 1 origin (`sewer_dweller`), 2 classes (`gravewalker`, `ironclad`), 5 zones (every zone in the game — `nightmarket`, `blackwire_sewers`, `static_yard`, `cinderworks`, `saltmere_docks`), 4 enemies (`trashboar_brute`, `foundry_warden`, `arc_sentinel`, `drowned_hauler` — the zone-anchor/heavy enemies content already introduced in 0.16-0.19). No new origins, classes, zones, or enemies were introduced by this build; every `targetId` references content that already existed.
- **`packages/content/src/ContentRegistry.ts`**: `ContentRegistryInput.lore: readonly LoreEntryContentDefinition[]`, `ContentRegistry.lore: ContentCollection<LoreEntryContentDefinition>` built via the same `createCollection("lore", input.lore)` helper every other content category already uses, wired into the module-level `contentRegistry` instantiation. No new abstraction — this is the identical pattern `objectives`, `townServices`, `vendorStocks`, etc. already follow.
- **`packages/content/src/index.ts`**: re-exports `lore` and the five new types (`LoreEntryContentDefinition`, `ClassLoreEntryDefinition`, `OriginLoreEntryDefinition`, `ZoneLoreEntryDefinition`, `EnemyLoreEntryDefinition`).
- **`packages/localization/src/locales/en.ts`**: 24 new keys, one `lore.<entry_id>.title` / `lore.<entry_id>.body` pair per entry — a short title and a paragraph of prose per entry, matching the existing project tone (dry, working-class-grim, consistent with the existing zone/enemy description strings).
- **`packages/content/src/ContentValidation.ts`**: `validateUniqueIds("lore", registry.lore.all, errors)` (the standard generic id-uniqueness check every category gets) plus a dedicated "Lore validation" block — the one part of this build genuinely custom to lore rather than a copy of an existing pattern — that confirms, per entry, both `titleKey`/`bodyKey` resolve to real `en.ts` keys and `targetId` resolves to a real id in the matching registry collection, switched on `targetKind` (`classes`/`origins`/`zones`/`enemies`). Its own comment states the intent directly: "prose lore can't silently drift out of sync with content the way it has in design docs."

### Verification

- **Existing, not new:** `test/content/contentRegistryValidation.test.ts` already exercises `validateContentRegistry` against the real registry, and passes with this content active — confirming every lore entry's `targetId` and both localization keys actually resolve, not just that the file compiles. No new test file was added specifically for lore: it introduces no new runtime code path (no room handler, no client rendering) that the existing content-validation coverage doesn't already reach.
- **Typecheck:** `pnpm -r typecheck` — clean across all 5 workspace packages, confirming the `ContentLocalizationKey` compile-time constraint holds for all 12 entries' `titleKey`/`bodyKey` fields.
- **Tests:** `pnpm --filter @doomscrolls/server test` — 40 files / 71 tests, all passing, with this content present in the tree throughout the same session's 0.24-0.29 verification work.

### Non-goals held

No UI surface for lore of any kind (stated explicitly in the feature's own doc comment as a deliberate future decision, not an oversight); no lore for content added after this build; no localization beyond English; no unlock/discovery mechanic or progress gating.

### Working-tree state

Committed on its own, immediately after this document was written, with `pnpm -r typecheck` reconfirmed clean immediately before the commit.
