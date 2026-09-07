# docs/CORE_BUILD_0_30_CHECKLIST.md — Core Build 0.30 Checklist

---

## Core 0.30 Checklist

**Date:** implemented in a prior, undocumented session (mtime evidence: `2026-09-06 23:30:44`–`23:32:10`, after 0.27/0.28's dated work and before 0.29's); this checklist written retroactively on 2026-09-07 during the Core 0.24-0.29 commit-splitting pass
**Build:** Core Build 0.30
**Theme:** Lore Content Foundation
**Status:** Implemented and verified (full suite green with it active in the tree). Was left uncommitted and undocumented for an unknown span of time before being identified and given this record.

### How This Build Was Found

- [x] While splitting the 0.24-0.29 working-tree diff into per-build commits, `packages/content/src/ContentValidation.ts` and `packages/localization/src/locales/en.ts` were found to carry hunks that matched no build's documented file footprint from 0.24 through 0.29
- [x] Confirmed via full diffs of both files that the unmatched hunks were a coherent, self-contained "lore" feature (validation block, 24 localization keys), not accidental noise
- [x] Traced the feature to its full extent: new `packages/content/src/data/lore.ts`, plus wiring in `ContentRegistry.ts`/`index.ts` — neither file appears in any 0.24-0.29 build's release notes
- [x] Searched every `docs/CORE_BUILD_*.md` for "lore" (word-boundary match, not substring) — found only in Core 0.4's docs, and only as an explicit non-goal ("no ... lore pages ... were introduced"), confirming this feature was never planned or attributed anywhere
- [x] Checked file mtimes: `lore.ts`/`ContentRegistry.ts`/`index.ts` cluster at `2026-09-06 23:30:44`–`23:32:10`, placing authorship after 0.27/0.28's dated session and before 0.29's — `ContentValidation.ts`/`en.ts`'s mtimes are not used as evidence (both were re-touched during this session's own commit-splitting edits, which disturbs mtime without changing content)
- [x] Deliberately excluded from every 0.24-0.29 commit, with an explicit note in the 0.26 and 0.29 commit messages naming exactly what was left out and why
- [x] User asked for it to be given the same retroactive-documentation treatment Core 0.13 got when it was found the same way, and for it to be committed on its own

### New Content Category

- [x] `packages/content/src/data/lore.ts`: `LoreEntryBase` + four `targetKind`-discriminated variants (`class`/`origin`/`zone`/`enemy`), unioned as `LoreEntryContentDefinition`
- [x] 12 entries authored: 1 origin (`sewer_dweller`), 2 classes (`gravewalker`, `ironclad`), 5 zones (every zone in the game), 4 enemies (the zone-anchor/heavy enemies from 0.16-0.19)
- [x] Every `targetId` confirmed to reference a real, pre-existing content id — no new origins/classes/zones/enemies introduced by this build

### Registry Wiring

- [x] `ContentRegistry.ts`: `ContentRegistryInput.lore`, `ContentRegistry.lore: ContentCollection<LoreEntryContentDefinition>` (via the standard `createCollection("lore", ...)`), wired into the top-level `contentRegistry` instantiation — same pattern as every other category, no new abstraction
- [x] `index.ts`: re-exports `lore` and the five new lore types

### Localization

- [x] 24 new keys in `packages/localization/src/locales/en.ts` (`lore.<id>.title` / `lore.<id>.body` per entry), in-voice with the project's existing tone

### Validation

- [x] `ContentValidation.ts`: `validateUniqueIds("lore", registry.lore.all, errors)` — the standard generic check
- [x] `ContentValidation.ts`: a dedicated lore-validation block confirming every `titleKey`/`bodyKey` resolves to a real `en.ts` key, and every `targetId` resolves to a real id in the matching collection (`classes`/`origins`/`zones`/`enemies`, switched on `targetKind`) — the one part of this build genuinely custom to lore

### Verification

- [x] `test/content/contentRegistryValidation.test.ts` (pre-existing, not new) already exercises `validateContentRegistry` against the real registry including this content — passing confirms every lore entry's `targetId` and localization keys actually resolve, not just that the file compiles
- [x] `pnpm -r typecheck` passes with this content active — confirms the `ContentLocalizationKey` constraint on `titleKey`/`bodyKey` is satisfied for all 12 entries at compile time
- [x] `pnpm --filter @doomscrolls/server test` passes — 40 files / 71 tests (confirmed as part of this same session's 0.24-0.29 verification, with lore content present in the tree throughout)

### Explicit Non-Goals

- [x] No UI surface for lore of any kind — stated in the feature's own doc comment as a deliberate future decision
- [x] No lore for content added after this build (no per-item, no per-skill lore)
- [x] No localization beyond English
- [x] No lore unlock/discovery mechanic or progress gating — every entry is static

### Working-Tree Discipline

- [x] Committed on its own, separately from the 0.24-0.29 batch, with `pnpm -r typecheck` confirmed clean immediately before the commit
