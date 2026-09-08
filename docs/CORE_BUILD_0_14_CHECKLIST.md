# docs/CORE_BUILD_0_14_CHECKLIST.md — Core Build 0.14 Checklist

---

## Core 0.14 Planning + Implementation Checklist

**Date:** 2026-09-02
**Build:** Core Build 0.14
**Theme:** A Third Combat Action, and a Real Cost to Dying
**Status:** Both pillars implemented and verified in one pass, per this build's brief (plan and implement together, no stop for review).

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_14_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_14_CHECKLIST.md`
- [x] Define Core Build 0.14 theme
- [x] Confirm Core Build 0.13 (combat handoff position persistence) is still green before starting new work
- [x] Investigate `heavy_strike`/a third skill slot end-to-end (protocol, server resolution, cooldown storage, both room handlers, client input, localization) via dedicated research, not assumption
- [x] Investigate death/respawn consequences end-to-end (current in-place respawn, the existing voluntary combat-return handoff, position/zone persistence, client room-switch generality) via dedicated research, not assumption
- [x] Confirm neither pillar requires inventing a new balance/tuning number
- [x] Define Core Build 0.14 pillars
- [x] Define explicit 0.14 non-goals
- [x] Define the 0.14 risk list
- [x] Define the in-process verification strategy up front
- [x] Identify that the "starting point" fix already in the working tree was itself an undocumented, uncommitted build — retroactively documented and numbered as Core Build 0.13, and this build renumbered from its original working title ("0.13") to 0.14 to make room for it (see `docs/CORE_BUILD_0_13_PLAN.md`)

### Core 0.14 Scope Guardrails

- [x] No enemy damage/armor/mitigation-formula changes anywhere in this build
- [x] No existing skill's `baseDamage`/`cooldownMs` changed — `heavy_strike.range` is the only content value touched, and it is a unit-consistency fix (1.4 → 64, matching every other skill's world-space-pixel unit), not a balance change
- [x] `TownRoom`'s own downed/corpse-recovery flow is unchanged — the death-redirect only changes `CombatRoom.registerRespawnHandler`
- [x] No XP, gold, or item loss added on death — the consequence is structural (leave the zone, travel back), not economic
- [x] The primary skill slot reuses the exact resolve/cooldown/damage pipeline `secondary`/`tertiary` already use — no new game logic, only a third value threaded through existing generic functions
- [x] The death-redirect reuses the exact `request_combat_return` handoff machinery (`resolveCombatZoneReturnSpawnId`, `CharacterService.updateCharacterRoomIntent`, `combat_town_return_approved`, the client's already-generic `beginTownRoomReturnHandoff`) — no new mechanic invented
- [x] Both pillars wired into both `TownRoom` and `CombatRoom` where parity matters (primary slot), avoiding a repeat of the one-room-only gap 0.12 had to fix for dodge/flask
- [x] Every new behavior lands as a vitest case in `apps/server/test/`, not a throwaway scripted client

### Pillar 1 — `heavy_strike` as a Primary Skill Slot

- [x] Widen `RequestUseSkillSlotClientMessage.slot` / `RequestUseSkillSlotAcceptedServerMessage.slot` / `RequestUseSkillSlotRejectedServerMessage.slot` to include `"primary"` (`packages/shared/src/protocol/`)
- [x] Widen `SkillSlotId` in `skillSlotContent.ts`; add the `"primary"` branch to `resolveSkillSlotDefinition` (resolves `startingSkillId`), `getSkillSlotCooldownAt`/`setSkillSlotCooldownAt`, `pendingActionTypeForSkillSlot`/`skillSlotForPendingActionType`
- [x] Widen `PendingActionType` (`pendingActionState.ts`) to include `"skill_primary"` — found via typecheck, not anticipated in the plan's file list, but the same single-point-of-truth shape as `skillSlotContent.ts`
- [x] Add `nextPrimarySkillSlotAt` to `PlayerPresence` schema (shared by both rooms), initialized to `0`
- [x] Widen the inline slot-literal check in both `TownRoom.ts` and `CombatRoom.ts`'s `registerSkillSlotHandler`
- [x] Fix `heavy_strike.range` from `1.4` to `64` in `packages/content/src/data/skills.ts`, with a comment explaining why (unit mismatch, not tuning)
- [x] Widen `sendSkillSlotIntent`'s slot parameter and `isSkillSlot` type guard in `skillSlotIntentClient.ts`
- [x] Add `apps/client/src/game/scenes/worldSession/worldSessionSkillPrimaryInput.ts` (structural clone of the tertiary input module, hotkey `1`)
- [x] Wire it into `WorldSessionScene.ts`: field declaration, two `destroy()` sites, construction + response callbacks, `"primary"` branch in both `onAccepted`/`onRejected` of `registerSkillSlotResponseListeners`
- [x] Add `world_session.control_skill_primary` and the 7-key `world_area.skill_primary_*` feedback set to `packages/localization/src/locales/en.ts`
- [x] Add a `"1 (enemy)"` row to the Controls panel binding list (`worldSessionOverlayView.ts`) so the new hotkey is discoverable
- [x] Add `apps/server/test/combat/primarySkillSlot.test.ts` (accept + cooldown round-trip)
- [x] Add `apps/server/test/town/primarySkillSlotParity.test.ts` (same-room-class parity, mirroring 0.12's dodge/flask parity discipline)
- [x] Extend `apps/server/test/content/skillSlotClassResolution.test.ts` with a fast, room-free "primary" resolution case for both classes
- [x] Regression-check discipline: reverted the `CombatRoom.ts` slot widen, confirmed `primarySkillSlot.test.ts` fails (timeout waiting for `_accepted`); reverted the `TownRoom.ts` slot widen, confirmed `primarySkillSlotParity.test.ts` fails; restored both, re-verified green

### Pillar 2 — Death in a Combat Zone Returns You to Nightmarket

- [x] Rewrite `CombatRoom.registerRespawnHandler` to perform the `combat_town_return_approved` handoff instead of an in-place respawn, reusing `resolveCombatZoneReturnSpawnId` + `isPositionInsideZoneBounds` + `CharacterService.updateCharacterRoomIntent` + `setPendingAction(..., "zone_transition")`
- [x] Confirm no client protocol/message-handling change is required — `WorldSessionScene.ts`'s existing `combat_town_return_approved` listener is already generic and reacts identically regardless of trigger
- [x] Remove now-unused `PlayerRespawnedServerMessage`/`COMBAT_SPAWN_BOX` imports from `CombatRoom.ts`
- [x] Add combat-zone-aware downed-panel copy (`worldSessionOverlayView.ts`): new `world_session.downed_respawn_hint_combat` / `world_session.respawn_to_town` keys, shown only when `resolveZoneKindLabel` reports a combat zone; `TownRoom`'s copy/behavior is unchanged
- [x] Add `apps/server/test/combat/deathReturnsToTown.test.ts`, mirroring `combatHandoffPositionPersistence.test.ts`'s exact pattern (assert the persisted destination `zoneId`/`x`/`y`/`hp`, and that `onLeave` does not double-persist after `client.leave()`)
- [x] Regression-check discipline: temporarily redirected the handoff's outbound message to a dummy type, confirmed `deathReturnsToTown.test.ts` fails (timeout waiting for `combat_town_return_approved`), restored, re-verified green

### Verification

- [x] Full `pnpm -r typecheck` passes across all 5 workspace packages
- [x] Full `pnpm --filter @doomscrolls/server test` passes: 16 files, 27 tests (up from 0.12's baseline of 13 files / 22 tests; Core Build 0.13 added the `combatHandoffPositionPersistence.test.ts` file this build's 27 already includes)
- [x] Both new regression tests independently confirmed to fail against the pre-fix code, then pass after
- [x] Dev client (`:5173`) and server (`:2567`) processes (already running under watch/HMR) confirmed still serving without a build error after all changes
- [~] Full interactive browser smoke test (press `1` near a live enemy; force a death and click through to Nightmarket) **not performed** — no browser-automation tooling (`chromium-cli`/Playwright) was available in this environment, and this game's login/character-creation/live-combat flow has no scripted shortcut to reach a downed state. Correctness for both pillars rests on the real regression-test suite (verified fail→pass) and Pillar 1's client code being a structural clone of the already-shipped, working tertiary skill module. Flagged here rather than claiming an interactive pass that did not happen.

### Explicit Non-Goals / Deferred Items

- [x] No balance/tuning changes (enemy damage, armor, mitigation, existing skill baseDamage/cooldownMs)
- [x] No persistent HUD cooldown card for the primary slot (mirrors tertiary's transient-notice-only footprint)
- [x] No change to `TownRoom`'s own downed/corpse-recovery flow
- [x] No XP/gold/item loss on death
- [x] No loadout/build-choice system (still open)
- [x] No new zones, classes, or enemy types
- [x] No objectives/quest depth

### Working-Tree Discipline

- [x] Nothing committed at any point in this build, per the task instruction — all changes remain working-tree only
- [x] Core Build 0.13's changes and this build's changes are attributed separately in docs (`CORE_BUILD_0_13_*.md` vs. `CORE_BUILD_0_14_*.md`) even though they are interleaved in the same uncommitted working tree, so a future commit split does not have to reverse-engineer which diff belongs to which build
