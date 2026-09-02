# docs/CORE_BUILD_0_13_PLAN.md — Core Build 0.13 Plan

## Status

**Retroactively documented.** This build's implementation already existed, complete and uncommitted, in the working tree before this document was written — it was authored in a prior session (between the `0.10-0.12` commit and the start of Core Build 0.14's planning) without a plan, checklist, or release notes, and was only identified and given its own build identity during Core Build 0.14's planning pass, after its "starting point" framing was flagged as an unlabeled dependency two of 0.14's pillars were quietly standing on.

This document reconstructs the plan a real planning pass would have produced, from the actual diff against `c211a10` (the `0.10-0.12` commit) and the fix's own code comments/test docstring, which already explained their own reasoning in detail. Nothing here changes what was implemented — it gives it the identity and record every other build in this repo has.

---

## Core 0.13 Theme

**Combat Zone Entry/Exit Position Integrity** — fixes a live-reported bug ("spawn outside the map" / "should spawn on the edge properly" when entering a combat zone from Nightmarket) with two independent root causes: a room's `onLeave` handler racing and clobbering an already-approved handoff's persisted destination, and the combat-zone entry landing position itself being computed from the wrong side's coordinates.

---

## The Bug

A player transitioning between Nightmarket and a combat zone (via the Blackwire Gate, in either direction) could land at a position numerically outside the destination zone's bounds. Two independent bugs combined to cause this:

**1. `onLeave` racing an approved handoff.** Both `TownRoom.onLeave` and `CombatRoom.onLeave` unconditionally persisted "this room's own zoneId + the player's last x/y" whenever a client disconnected — including immediately after a `request_interact` (town→combat) or `request_combat_return` (combat→town) handoff had just been approved and had already persisted the *correct* destination via `CharacterService.updateCharacterRoomIntent`. Since the real client calls `room.leave()` right after receiving the approval message, `onLeave` always ran a beat later on the room being left, and blindly overwrote the correct just-persisted destination with the leaving room's own stale zoneId/position. Whichever room the player landed in next would then restore from that clobbered value.

**2. The combat-zone entry landing position used the wrong side's coordinates.** `waypointService.ts`'s `resolveRouteTravel`, for a town→combat handoff, was using the *Nightmarket-side* gate spawn's raw `x`/`y` (e.g. `nightmarket_blackwire_combat_entry`: `2860, 2120`) as the landing position inside the *combat* zone — coordinates that are nightmarket-scale, not combat-zone-scale. Blackwire Sewers' and Static Yard's bounds only run `0-800 × 0-600`, so `(2860, 2120)` is numerically far outside either zone. This was silent because nothing validated that a restored position actually belonged to the zone being joined.

Both bugs were real, independent, and needed independent fixes — fixing only #1 would still land players at bug #2's wrong coordinates; fixing only #2 would still let a stray `onLeave` clobber a correct position with a stale one.

---

## What Changed

### Root cause #1 — `onLeave` guards (`apps/server/src/realtime/rooms/TownRoom.ts`, `CombatRoom.ts`)

- **`TownRoom.onLeave`**: added a guard reading a duck-typed `pendingRoomHandoff` boolean already set on the player's presence by the town→combat handoff path (`request_interact`'s combat-gate branch) once it approves — when true, `onLeave` skips its own `CharacterService.updateCharacterLocation` call entirely, leaving the handoff's own persisted destination untouched.
- **`CombatRoom.onLeave`**: added the equivalent guard using `CombatRoom`'s own pending-action mechanism (`player.hasPendingAction && player.pendingActionType === "zone_transition"`, set by `registerCombatReturnHandler` before it persists and approves) — the same intent, using the mechanism already native to this room rather than importing `TownRoom`'s.

### Root cause #2 — real interior landing positions (`apps/server/src/realtime/rooms/waypointService.ts`, `buildCombatPlayerPresence.ts`)

- **`waypointService.ts`**: introduced `COMBAT_ZONE_ENTRY_X`/`COMBAT_ZONE_ENTRY_Y`, derived from `COMBAT_SPAWN_BOX`'s own center (the same box `initializeCombatEnemies.ts` already uses to place enemies) — the real interior landing point for *any* combat zone, since both currently share identical bounds. `resolveRouteTravel`'s combat-gate branch now returns this as the actual `x`/`y`, while still validating the Nightmarket-side spawn record separately as a content-integrity check only (its coordinates are never reused as the landing position anymore).
- **`buildCombatPlayerPresence.ts`**: added a zone-match guard (`restoredZoneId === input.resolvedZoneId`) before trusting a restored position at all — without it, a stale/mismatched `(zoneId, x, y)` triple could pass the bounds check purely by numeric coincidence (Nightmarket's bounds are far larger than any combat zone's) and be used as a combat-zone spawn point anyway. Also changed the no-restored-position fallback from the raw `(0, 0)` zone corner to `COMBAT_SPAWN_BOX`'s own center — a bare corner has no guarantee of being real, walkable floor.

### Bundled client-side fixes

- **The `combat_return_gate` interactable became directly clickable**, not just reachable through the "Return to Town" UI button: `WorldInteractionIntent.ts` gained a `CombatReturnIntent` type and an `objectType` field on hit-test results; `resolveWorldInteraction.ts` routes a click on a `combat_return_gate`-typed object to it; `dispatchWorldInteraction.ts` and a new `pendingInteractTracker.ts` "combat_return" kind send it via a new `apps/client/src/net/combatReturnIntentClient.ts`; `worldSessionAreaView.ts` and `worldSessionInteractablesView.ts` handle the move-closer-then-trigger flow and expose `objectType` from the click hit-test.
- **The HUD's zone display stopped being hardcoded.** `worldSessionAreaBannerView.ts`'s `resolveZoneDisplayName` was exported (previously private) and `worldSessionOverlayView.ts`'s character chip now shows the player's real current zone name and a zone-kind label ("Combat Zone"/"Town", derived from the zone's own `roomType` content) instead of a hardcoded `"The Nightmarket"` string that was wrong the moment a player was anywhere else.

---

## Verification Strategy

- New `apps/server/test/town/combatHandoffPositionPersistence.test.ts`: joins `TownRoom`, stands the player on the Blackwire Gate, sends `request_interact`, awaits `town_combat_handoff_approved`, then mirrors the real client by calling `client.leave()` immediately — asserting `CharacterService.updateCharacterRoomIntent` was called exactly once with the combat zone's real interior entry position (`138, 470` — `COMBAT_SPAWN_BOX`'s center), and that `updateCharacterLocation` (what `onLeave`'s old, unguarded code called) was never invoked.
- `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test` both pass.

---

## Core 0.13 Non-Goals

```text
no balance/tuning changes
no new zones, classes, skills, or enemy types
no death/respawn consequences, loadout system, or objectives/quest depth
```

---

## Summary

Core Build 0.13 is a targeted bugfix build closing a live-reported "spawn outside the map" report with two independent, both-necessary root-cause fixes (an `onLeave` race clobbering an approved handoff's persisted position, and the combat-zone entry landing position using the wrong side's coordinates), plus two bundled client-side quality-of-life fixes found during the same investigation (a directly-clickable return gate, and a HUD zone display that was hardcoded wrong). It was implemented and verified in a prior session but never given a plan, checklist, release notes, or commit; this document — along with `docs/CORE_BUILD_0_13_CHECKLIST.md` and `docs/CORE_BUILD_0_13_RELEASE_NOTES.md` — retroactively gives it the same record every other build in this repo has, and frees "0.13" from being informally attached to Core Build 0.14's own, unrelated work.
