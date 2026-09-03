# docs/CORE_BUILD_0_21_RELEASE_NOTES.md — Core Build 0.21 Release Notes

---

## Task — The Bottom HUD Becomes an ARPG HUD

**Date:** 2026-09-03
**Build:** Core Build 0.21
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed until this note.

### Summary

The bottom-center world-session HUD (`worldSessionOverlayView.ts`'s
`createHudSection`) was a stacked text card: a labelled HP progress bar,
flask charges as a row of dots and a fraction, a skill-cooldown card,
and up to two quest-tracker cards. Per `docs/CORE_BUILD_0_21_PLAN.md`
it's rebuilt around a PoE-style dual-orb cluster: a real HP orb and a
visually-stubbed resource orb flanking a 5-slot flask/belt strip (1 real
`flask_1` slot, 4 visually-locked stub slots), with the existing
skill-cooldown card and quest trackers moved above the cluster instead
of interleaved with it.

Real, wired elements were restyled, not reimplemented: the HP orb reads
the same `hp`/`maxHp`/`lifeState` presence fields the old bar read
(same downed-state red), and the flask belt slot reads the same
`flaskCharges`/`maxFlaskCharges`/`[Q]` data the old dot-row read — just
drawn as a liquid-filled circular vessel and an item-slot tile. Stubbed
elements (the resource orb, belt slots 2-5) have no backing data at
all — Core 0.1 has no mana/resource system and the belt has exactly one
real slot — and are drawn unmistakably inert: dashed/desaturated
borders, a lock glyph, a "Soon" / "Coming Later" label, `not-allowed`
cursor, no keybind badge, no click handler.

`createFlaskChargesLine` (the old dot-row renderer) had its only caller
removed and was deleted rather than left dead. Two new localization
keys were added (`world_session.belt_slot_soon`,
`world_session.belt_slot_soon_hint`); the stub-orb keys
(`world_session.resource`, `world_session.resource_placeholder`) already
existed, unused, from an earlier build and are now wired up.

### Verified

- `pnpm typecheck` clean across all 5 workspace packages.
- `pnpm --filter @doomscrolls/client lint` and
  `pnpm --filter @doomscrolls/localization lint` clean.
- Live-checked with Playwright against the running dev stack (Docker
  Postgres/Redis already up, `pnpm dev:all` already running): registered
  a fresh account, created a character, entered The Nightmarket, and
  screenshotted the HUD. Confirmed: HP orb shows real `45/45 (100%)`;
  the flask slot shows the real starter flask's 3 charges (transiently
  shows a waiting state for the one frame before presence sync arrives,
  same as the old dot-row did); the 4 stub belt slots and the resource
  orb render visibly locked/greyed with "Soon"/"Coming Later" and a lock
  glyph; no console or page errors. Re-checked at a 480px viewport width
  — the cluster wraps the resource orb to a second centered line rather
  than clipping or overlapping.
- Not covered: combat damage (HP orb's low-HP color shift) and flask
  consumption (charge count decrementing) were not exercised live in
  this pass — both reuse the exact same presence fields and thresholds
  the previous bar/dot-row already used, so this is a restyle-only risk,
  not new logic.

### File footprint

`worldSessionOverlayView.ts` (`createHudSection` rebuilt; new
`createVitalityClusterRow`/`createOrbShell`/`createHpOrb`/
`createResourceOrbStub`/`createBeltStrip`/`createBeltSlotShell`/
`createFlaskBeltSlot`/`createStubBeltSlot` helpers; `createFlaskChargesLine`
removed), `worldSessionOverlayLayout.ts` (HUD panel width), `en.ts` (2
new keys). No server, protocol, or content changes — this build only
reads fields that already existed.
