# docs/CORE_BUILD_0_14_RELEASE_NOTES.md — Core Build 0.14 Release Notes

---

## Task — A Third Combat Action, and a Real Cost to Dying

**Date:** 2026-09-02
**Build:** Core Build 0.14
**Status:** Both pillars implemented and verified in one pass, per this build's brief (plan and implement together). Working-tree only — nothing committed.

### Summary

0.10-0.13 were wiring/integrity fixes, not new gameplay. Core Build 0.14 closes two of the backlog's longest-standing, most-repeatedly-named gaps: `heavy_strike` — flagged as the natural next step in three prior plans (0.9, 0.11, 0.12) — becomes a real, playable third combat action ("primary" skill slot), and death in a combat zone, which previously had zero consequence at all, now sends the player back to Nightmarket instead of a free in-place respawn.

Before this build's own work began, the working tree already carried a complete, verified fix that turned out to be **Core Build 0.13** — a combat-zone entry/exit position-integrity fix (`TownRoom`/`CombatRoom` `onLeave` no longer clobbers an already-approved zone-transition's persisted position with the leaving room's own stale coordinates). It had been implemented in a prior session but never given a plan, checklist, release notes, or commit. That gap was caught during this build's planning: git history and file timestamps confirmed it postdates the `0.10-0.12` commit and predates any 0.14 work, so it was retroactively documented in its own right as **Core Build 0.13** (see `docs/CORE_BUILD_0_13_RELEASE_NOTES.md`), and this build was renumbered from its original working title ("0.13") to **0.14** to make room for it. It was confirmed still green (13 files / 22 tests) before this build's planning started, and this build's death-redirect pillar directly reuses the same guard mechanism it introduced.

Planning docs: `docs/CORE_BUILD_0_14_PLAN.md`, `docs/CORE_BUILD_0_14_CHECKLIST.md`.

### What changed — Pillar 1: `heavy_strike` as a Primary Skill Slot

- **Protocol** (`packages/shared/src/protocol/ClientMessages.ts`, `ServerMessages.ts`): `RequestUseSkillSlotClientMessage.slot`, `RequestUseSkillSlotAcceptedServerMessage.slot`, and `RequestUseSkillSlotRejectedServerMessage.slot` widened from `"secondary" | "tertiary"` to `"primary" | "secondary" | "tertiary"`.
- **`apps/server/src/realtime/rooms/skillSlotContent.ts`**: `SkillSlotId` widened; `resolveSkillSlotDefinition`'s `"primary"` branch resolves the class's `startingSkillId` (a field every class definition already carried but that no slot had ever consulted); `getSkillSlotCooldownAt`/`setSkillSlotCooldownAt` and `pendingActionTypeForSkillSlot`/`skillSlotForPendingActionType` all gained a third branch.
- **`apps/server/src/realtime/rooms/pendingActionState.ts`**: `PendingActionType` widened to include `"skill_primary"` — surfaced by `pnpm -r typecheck`, not anticipated in the original plan's file list, but the same kind of single-point-of-truth union as `skillSlotContent.ts`'s own types.
- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: added `nextPrimarySkillSlotAt`, a third independent cooldown field alongside the existing secondary/tertiary ones, shared by both rooms automatically.
- **`apps/server/src/realtime/rooms/TownRoom.ts` / `CombatRoom.ts`**: each `registerSkillSlotHandler`'s inline slot-literal check widened to accept `"primary"`. These handlers are duplicated per room (not shared), so both needed the same one-line change — verified independently in both rooms (see Verification), the same discipline 0.12 used for dodge/flask parity.
- **`packages/content/src/data/skills.ts`**: fixed `heavy_strike.range` from `1.4` to `64`. This was a real, pre-existing unit-consistency bug — every other skill's `range` is authored in world-space pixels (`grave_spark` 96, `bone_splinter` 140, `shatter_blow` 64, `groundbreaker` 80); `heavy_strike` was never resolved by any input path before this build, so the mismatch went unnoticed. Left uncorrected, a primary cast would fail `out_of_range` at any realistic distance. `64` matches `shatter_blow`, the other melee-flavored skill. `baseDamage`/`cooldownMs` are untouched — this is a unit-correctness fix, not a balance decision.
- **Client**: `apps/client/src/net/skillSlotIntentClient.ts` widened; new `apps/client/src/game/scenes/worldSession/worldSessionSkillPrimaryInput.ts` (a structural clone of the existing, shipped `worldSessionSkillTertiaryInput.ts` — same target-provider shape, same transient-notice-only feedback, same redundant Phaser-key + `window.keydown` binding pattern) owns the new `1` hotkey; `WorldSessionScene.ts` wired at the same five touch points tertiary already has (field, two `destroy()` sites, construction/callbacks, and a `"primary"` branch in both `onAccepted`/`onRejected`).
- **Localization**: added `world_session.control_skill_primary` and the same seven-key `world_area.skill_primary_*` feedback set tertiary has, plus a `"1 (enemy)"` row in the Controls panel's binding list so the new hotkey is discoverable. No `LocaleTypes.ts` change was needed — `LocalizationKey` is `keyof typeof en`, and `heavy_strike`'s own name/description keys already existed and were already required.

### What changed — Pillar 2: Death in a Combat Zone Returns You to Nightmarket

- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: `registerRespawnHandler` no longer resurrects a downed player in place (full HP, teleport to the combat-spawn-box centre, stay in the room). It now performs the exact same handoff `request_combat_return` already used for a voluntary gate-click return: resolve the destination via `resolveCombatZoneReturnSpawnId(state.zoneId)`, validate it with `isPositionInsideZoneBounds`, set the same `pendingActionType: "zone_transition"` guard the voluntary path sets (so `onLeave`'s existing guard — introduced by Core Build 0.13's position-persistence fix — correctly skips its own persistence), persist through `CharacterService.updateCharacterRoomIntent` with full HP/flask charges, and send `combat_town_return_approved`.
- **No client protocol or message-handling change was required for this pillar.** `WorldSessionScene.ts`'s `combat_town_return_approved` listener (`beginTownRoomReturnHandoff`) was already fully generic — it reacts to the message, not to how the handoff was triggered. The existing "Respawn" button (`handleRespawn`/`sendRespawnRequest`) is unchanged; only the server's response to it changed.
- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: the downed panel now shows combat-specific copy (new `world_session.downed_respawn_hint_combat` / `world_session.respawn_to_town` keys) when the current zone's `roomType` is `"combat"`, using the already-present `resolveZoneKindLabel` helper (added by Core Build 0.13) — so the button's label/hint matches what it actually does now, instead of the old town-flavored "Respawn at safe point." `TownRoom`'s own downed/corpse-recovery copy and behavior are unchanged.
- **No new balance number was introduced.** HP-on-arrival reuses the existing "full restore" behavior the in-place respawn already had; the landing position reuses the existing, already-tested `resolveCombatZoneReturnSpawnId` lookup and its real content coordinates (`nightmarket_blackwire_combat_entry`: `x: 2860, y: 2120`); the handoff message, persistence call, and client room-switch are all pre-existing and unmodified in shape. This is a structural consequence (leave the zone, travel back in), not a tuning one.

### Verification

Per `AGENTS.md`'s "Verification Must Be Permanent" rule:

**In-process (`apps/server/test/`, `pnpm --filter @doomscrolls/server test` — 16 files, 27 tests, all passing, up from 0.12's 13 files / 22 tests; Core Build 0.13 accounts for one of those files, `test/town/combatHandoffPositionPersistence.test.ts`):**

- `test/combat/primarySkillSlot.test.ts` (new): a primary cast against an in-range enemy in `CombatRoom` lands `heavy_strike`'s real damage (`3 + power/equipment bonus`); an immediate re-cast is rejected `skill_on_cooldown`.
- `test/town/primarySkillSlotParity.test.ts` (new): the same cast accepted in `TownRoom` too — proving the fix landed in both rooms, not just one, since `registerSkillSlotHandler` is a separate implementation per room.
- `test/content/skillSlotClassResolution.test.ts` (extended): a fast, room-free case proving `resolveSkillSlotDefinition("primary", ...)` resolves `startingSkillId` (`heavy_strike`) for both classes.
- `test/combat/deathReturnsToTown.test.ts` (new): a downed player's `request_respawn` produces `combat_town_return_approved` with `targetZoneId: "nightmarket"` and the real `nightmarket_blackwire_combat_entry` coordinates (not an in-zone position), persists exactly once via `updateCharacterRoomIntent` with full HP, and confirms `onLeave` does not double-persist after the client leaves — mirroring `test/town/combatHandoffPositionPersistence.test.ts`'s exact pattern for the reverse direction.
- **Regression-check discipline** (per 0.9-0.13's established practice): the `CombatRoom.ts` and `TownRoom.ts` primary-slot widens, and the death-handoff's outbound message, were each temporarily reverted/disabled in turn and the corresponding new test confirmed to fail (timeouts waiting for `request_use_skill_slot_accepted` / `combat_town_return_approved`) before being restored and re-verified green.

**Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace packages.

**Live verification:** the dev client (`:5173`) and server (`:2567`) processes were confirmed still serving without a build error after all changes (both already running under watch/HMR from a prior session). A full interactive browser smoke test (pressing `1` near a live enemy; forcing a death and clicking through to Nightmarket) was **not performed** — no browser-automation tooling (`chromium-cli`/Playwright) was available in this environment, and reaching an authenticated, in-combat, downed state has no scripted shortcut. This is flagged explicitly rather than claimed: correctness for both pillars rests on the real, verified-fail-then-pass regression suite above, plus Pillar 1's client code being a structural clone of the already-shipped, working tertiary skill module and Pillar 2 requiring no new client interaction pattern at all.

### Non-goals held

No enemy damage/armor/mitigation-formula changes; no existing skill's `baseDamage`/`cooldownMs` changed (`heavy_strike.range` is a unit-consistency fix, not tuning); no persistent HUD cooldown card for the primary slot; no change to `TownRoom`'s own downed/corpse-recovery flow; no XP/gold/item loss on death; no loadout/build-choice system; no new zones, classes, skills, or enemy types; no objectives/quest depth — all exactly as scoped in the plan.

### Working-tree state

Nothing was committed at any point in this build, per the task instruction. This build's changes and Core Build 0.13's changes are interleaved in the same uncommitted working tree (both touch `CombatRoom.ts`, `TownRoom.ts`, and `worldSessionOverlayView.ts`) but are documented and attributed separately (`docs/CORE_BUILD_0_13_*.md` vs. this file) so a future commit split can cleanly land them as two commits, in build order, rather than one undifferentiated blob.
