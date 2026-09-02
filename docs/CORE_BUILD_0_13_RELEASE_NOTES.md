# docs/CORE_BUILD_0_13_RELEASE_NOTES.md — Core Build 0.13 Release Notes

---

## Task — Combat Zone Entry/Exit Position Integrity

**Date:** implemented in a prior, undocumented session; these notes written retroactively on 2026-09-02 during Core Build 0.14's planning pass
**Build:** Core Build 0.13
**Status:** Implemented and verified. Was left uncommitted and undocumented for an unknown span of time before being identified and given this record. Still working-tree only.

### Summary

This build fixes a live-reported bug — players seeing their character "spawn outside the map" or wanting it to "spawn on the edge properly" when entering a combat zone from Nightmarket. Two independent bugs combined to cause it: `TownRoom`/`CombatRoom`'s `onLeave` handlers would race and clobber an already-approved room handoff's correctly-persisted destination with the leaving room's own stale position, and separately, the combat-zone entry landing position was being computed from the Nightmarket-side gate's raw coordinates instead of a real point inside the destination zone. Fixing only one would still have left the bug reproducible via the other path.

### How this release note came to exist

This build's implementation predates its own documentation. It was written in a session sometime after the `0.10-0.12` commit (`2026-09-01 23:01:04`) and before Core Build 0.14's planning began — confirmed by `git diff c211a10` (a real, additional diff on top of that commit) and by every file in the fix having a last-modified timestamp between `23:44` and `00:20` that same night. It was never committed and had no plan, checklist, or release notes anywhere in the repo. Core Build 0.14's planning pass initially treated it as an anonymous "starting point," which is what surfaced the gap: it was flagged as an unlabeled dependency two of 0.14's pillars were quietly standing on, and is documented here in its own right as a result. See `docs/CORE_BUILD_0_13_PLAN.md` for the full reconstructed plan and `docs/CORE_BUILD_0_13_CHECKLIST.md` for the itemized checklist.

### What changed

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: `onLeave` now skips its own location persistence when the player's presence carries an already-approved `pendingRoomHandoff` — previously it always ran a beat after a handoff's own persistence (since the real client calls `room.leave()` right after receiving the approval) and unconditionally overwrote the correct destination with `TownRoom`'s own zoneId and the player's stale in-room x/y.
- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: the equivalent fix, using `CombatRoom`'s own pending-action mechanism (`hasPendingAction && pendingActionType === "zone_transition"`, set by `registerCombatReturnHandler`) rather than importing `TownRoom`'s flag.
- **`apps/server/src/realtime/rooms/waypointService.ts`**: a town→combat handoff now lands the player at `COMBAT_ZONE_ENTRY_X`/`Y` — the combat zone's own interior entry point, derived from `COMBAT_SPAWN_BOX`'s center (the same box enemy spawning already uses) — instead of the Nightmarket-side gate spawn's raw coordinates (e.g. `2860, 2120`), which are nightmarket-scale and numerically outside either combat zone's much smaller `0-800 × 0-600` bounds. The Nightmarket-side spawn record is still validated, but now only as a content-integrity check, never reused as the actual landing position.
- **`apps/server/src/realtime/rooms/buildCombatPlayerPresence.ts`**: a restored position is now only trusted when its `zoneId` matches the zone actually being joined (previously a stale/mismatched position could pass the bounds check by numeric coincidence, since Nightmarket's bounds are far larger than any combat zone's); the no-restored-position fallback changed from the raw `(0, 0)` zone corner to `COMBAT_SPAWN_BOX`'s own center, a guaranteed-walkable interior point.
- **Client — `combat_return_gate` became directly clickable**: `WorldInteractionIntent.ts` (new `CombatReturnIntent` type, `objectType` on hit-test results), `resolveWorldInteraction.ts` (routes a `combat_return_gate` click to it), `dispatchWorldInteraction.ts`/`pendingInteractTracker.ts` (dispatch + move-closer-then-trigger), new `apps/client/src/net/combatReturnIntentClient.ts`, `worldSessionAreaView.ts`/`worldSessionInteractablesView.ts` (hit-test `objectType` passthrough and in-range/move-closer handling) — previously the gate could only be triggered through a separate "Return to Town" UI button.
- **Client — HUD zone display fixed**: `worldSessionAreaBannerView.ts`'s `resolveZoneDisplayName` was exported (previously private); `worldSessionOverlayView.ts`'s character chip now shows the player's real current zone name and a content-driven zone-kind label ("Combat Zone"/"Town") via new `resolveCurrentZoneId`/`resolveZoneKindLabel` helpers, instead of a hardcoded `"The Nightmarket"` string that was wrong everywhere except Nightmarket itself.

### Verification

- **New:** `apps/server/test/town/combatHandoffPositionPersistence.test.ts` — joins `TownRoom`, stands the player on the Blackwire Gate, sends `request_interact`, awaits `town_combat_handoff_approved` (asserting `targetZoneId === "blackwire_sewers"`), then mirrors the real client's immediate `client.leave()`. Asserts `CharacterService.updateCharacterRoomIntent` was called exactly once with the combat zone's real interior entry position (`x: 138, y: 470` — `COMBAT_SPAWN_BOX`'s center), and that `updateCharacterLocation` (the call `onLeave`'s old, unguarded code made) was never invoked — the exact regression this build fixes.
- **Typecheck:** `pnpm -r typecheck` — 0 errors across all 5 workspace packages. Reconfirmed at the start of Core Build 0.14's planning pass.
- **Tests:** `pnpm --filter @doomscrolls/server test` — 13 files, 22 tests, all passing. Reconfirmed at the start of Core Build 0.14's planning pass.

### Non-goals held

No balance/tuning changes; no new zones, classes, skills, or enemy types; no death/respawn consequences, loadout system, or objectives/quest depth.

### Working-tree state

Not committed by this build or by Core Build 0.14. Both remain in the same working tree; a future commit should land this build's diff separately and first, in build order, since Core Build 0.14 directly depends on the `onLeave` guard mechanism this build introduced.
