# docs/CORE_BUILD_0_14_PLAN.md — Core Build 0.14 Plan

## Status

**Planned and implemented in a single pass** (per this build's brief — no stop for review between planning and implementation). Core Build 0.12 shipped dodge/flask parity between `TownRoom` and `CombatRoom`. Core Build 0.13 (see `docs/CORE_BUILD_0_13_PLAN.md`) then shipped a combat-zone-entry/exit position-integrity fix. Both are the stable baseline this build starts from. 0.10-0.13 were wiring/integrity fixes, not new gameplay — this build is explicitly scoped to close that gap.

No balance/tuning changes are part of this plan, per the standing "wire it correctly, don't tune it" discipline (0.10-0.13) and this build's own brief, which keeps balance off-limits pending a human-set target curve.

---

## Core 0.14 Theme

**A Third Combat Action, and a Real Cost to Dying** — `heavy_strike` becomes a playable "primary" skill slot alongside the existing secondary/tertiary slots, and death in a real combat zone now pulls the player out of the fight and back to Nightmarket instead of a free, consequence-free in-place respawn.

---

## Starting Point: Core Build 0.13 Was Already Sitting in the Working Tree, Undocumented

Before this build's planning began, the working tree already carried a complete, verified fix that turned out to be **Core Build 0.13** — a combat-zone entry/exit position-integrity fix (`TownRoom`/`CombatRoom` `onLeave` no longer clobbers an already-approved zone-transition's persisted position with the leaving room's own stale coordinates; `buildCombatPlayerPresence`/`waypointService` land players at a real interior point instead of a nightmarket-scale one). It had been implemented in some prior session but never given a plan, checklist, release notes, or commit — it existed only as unlabeled diffs, indistinguishable at a glance from whatever came next.

That ambiguity was caught and corrected before this build's own docs were finalized: git history and file timestamps confirmed the fix postdates the `0.10-0.12` commit and predates this build's own work, so it was retroactively documented as **Core Build 0.13** (`docs/CORE_BUILD_0_13_PLAN.md`/`CHECKLIST.md`/`RELEASE_NOTES.md`) in its own right, and this build was renumbered from its original working title ("0.13") to **0.14** to make room for it. `pnpm -r typecheck` (0 errors) and `pnpm --filter @doomscrolls/server test` (13 files / 22 tests) were both confirmed green on Core Build 0.13's own state before 0.14 work began. Per this build's instruction, nothing is committed — Core Build 0.13's changes and all 0.14 changes remain working-tree only, and are expected to land as two separate commits when that time comes, in build order.

This dependency matters directly to Pillar 2 below: the death-redirect reuses the exact `setPendingAction(..., "zone_transition")` / `onLeave`-guard mechanism Core Build 0.13 introduced, for the same reason (a handoff's persisted target position must not be overwritten by the room the player is leaving).

---

## What This Planning Pass Found

Two backlog items were investigated in depth (via dedicated research passes over the actual handler code, not assumption):

**1. `heavy_strike` is real, bounded, and has been named as the natural next step three plans running (0.9, 0.11, 0.12).** It is `startingSkillId` on both classes, has real content (`range: 1.4`, `cooldownMs: 1000`, `baseDamage: 3`), and is validated for existence — but resolved by zero input paths. 0.12's plan confirmed the reason it was never wired: `request_use_skill_slot.slot` is hard-typed to `"secondary" | "tertiary"`, with no third value, no client hotkey, and no UI affordance. This build does the work 0.12 declined to scope: extend the union, add a real hotkey, and route it through the identical resolve/cooldown/cast pipeline the other two slots already use.

  - **One real wiring bug found and fixed as part of this**: `heavy_strike.range` (`1.4`) is authored in a different unit than every other skill's range (`grave_spark` 96, `bone_splinter` 140, `shatter_blow` 64, `groundbreaker` 80 — all world-space pixel units). Left as-is, a primary cast would fail `out_of_range` at any realistic distance. This is corrected to `64` (matching `shatter_blow`, the other melee-flavored skill) as a **unit-consistency bug fix**, not a balance decision — `baseDamage` and `cooldownMs` are untouched.

**2. Death in a combat zone has no consequence at all.** `CombatRoom.registerRespawnHandler` today does a free, instant, in-place respawn: full HP, full flask charges, teleport to the exact center of `COMBAT_SPAWN_BOX`, `lifeState` flipped back to `"alive"` — the player never leaves the room or loses anything. `TownRoom`'s downed state already has its own consequence (corpse recovery); `CombatRoom`'s does not. Investigation confirmed the fix does **not** require inventing any balance number (no XP loss, no gold loss, no HP penalty): `CombatRoom` already has a fully-built, already-tested voluntary combat→town handoff (`request_combat_return`, gated behind clicking the `combat_return_gate` interactable) that persists a real destination position via `resolveCombatZoneReturnSpawnId` + `CharacterService.updateCharacterRoomIntent` and sends `combat_town_return_approved`. The client's reaction to that message (`beginTownRoomReturnHandoff` in `WorldSessionScene.ts`) is **already fully generic** — it does not care how the handoff was triggered, only that the message arrived. Redirecting death through this exact same machinery, instead of building anything new, is a purely structural/positional consequence: you are pulled out of the zone and must travel back in, not simply healed in place.

---

## Why These Two Pillars Belong in the Same Build

Both close long-named backlog items with a shared shape — reusing already-correct machinery from an adjacent room/feature rather than inventing new mechanics — the same discipline 0.9-0.13 established for dodge/flask parity and position integrity. They are independent (no shared code path, can be implemented and tested in either order) but are naturally sized to fit in one session together: Pillar 1 is protocol + two room handlers + a new client hotkey module + content/localization; Pillar 2 is a single handler rewrite in one file, reusing an existing handoff wholesale. Doing both also avoids a false impression that 0.14 was "just the death fix" or "just the skill slot" when the brief asked for real gameplay depth, not a single narrow slice.

---

## Pillar 1: `heavy_strike` as a Playable "Primary" Skill Slot

**Goal:** Pressing `1` while a target is hovered/selected casts `heavy_strike` through the same server-authoritative resolve/cooldown/damage pipeline `secondary`/`tertiary` already use, in both `TownRoom` and `CombatRoom` (wiring it into only one room would recreate exactly the kind of parity gap 0.12 had to fix for dodge/flask).

### Protocol (`packages/shared/src/protocol/`)

- `ClientMessages.ts`: widen `RequestUseSkillSlotClientMessage.slot` to `"primary" | "secondary" | "tertiary"`.
- `ServerMessages.ts`: widen the same union on `RequestUseSkillSlotAcceptedServerMessage.slot` and `RequestUseSkillSlotRejectedServerMessage.slot`.

### Server — single point of resolution logic (`apps/server/src/realtime/rooms/skillSlotContent.ts`)

- `SkillSlotId` → add `"primary"`.
- `resolveSkillSlotDefinition`: three-way branch; `"primary"` resolves `characterClass.startingSkillId` (already a real field, just unused by this function today).
- `getSkillSlotCooldownAt` / `setSkillSlotCooldownAt`: three-way branch against a new `PlayerPresence` field.
- `pendingActionTypeForSkillSlot` / `skillSlotForPendingActionType`: add `"skill_primary"` ↔ `"primary"` mapping (used by the existing move-then-cast deferred-action queue in `deferredActionExecution.ts`, which needs no direct edit since it already goes through these helpers generically).

### Server — schema (`apps/server/src/realtime/rooms/PlayerPresence.ts`)

- Add `@type("number") public nextPrimarySkillSlotAt: number;` alongside the existing `nextSkillSlotAt`/`nextTertiarySkillSlotAt`, initialized to `0` in the constructor. This one schema class is shared by both rooms (`buildPlayerPresence.ts` for `TownRoom`, `buildCombatPlayerPresence.ts` for `CombatRoom`), so the field is available in both automatically.

### Server — handlers (duplicated per room, not shared — each needs the same one-line widen)

- `TownRoom.ts` and `CombatRoom.ts`: each `registerSkillSlotHandler`'s inline slot-literal check (`message?.slot === "secondary" || message?.slot === "tertiary"`) gets a third `|| message?.slot === "primary"` branch. Everything downstream (`resolveSkillSlotDefinition`, cooldown get/set, damage resolution, response messages) is already slot-generic and needs no further change in either handler body.

### Content (`packages/content/src/data/skills.ts`)

- Fix `heavy_strike.range` from `1.4` to `64` (see "What This Planning Pass Found" above) — the one content value this build touches, and it is a unit-correctness fix, not a tuning change.

### Client

- `apps/client/src/net/skillSlotIntentClient.ts`: widen `sendSkillSlotIntent`'s `slot` parameter type and the local `isSkillSlot` type guard to include `"primary"`.
- New `apps/client/src/game/scenes/worldSession/worldSessionSkillPrimaryInput.ts`: a direct structural clone of `worldSessionSkillTertiaryInput.ts` — owns the `1` hotkey (`Phaser.Input.Keyboard.KeyCodes.ONE` + a raw `window.addEventListener("keydown", ...)` fallback matching the existing redundant-binding pattern), targets whatever enemy is hovered/selected (same target provider as tertiary), transient-notice feedback only (no persistent HUD cooldown card — the same reduced footprint tertiary deliberately uses, appropriate for a small additional action rather than a second full HUD subsystem).
- `WorldSessionScene.ts`: mirror tertiary's five touch points — field declaration, two `destroy()` call sites, construction + response-callback wiring, and a `message.slot === "primary"` branch in both the accepted and rejected handlers of the existing `registerSkillSlotResponseListeners` call (routing to the new module, exactly as `"tertiary"` already routes to `tertiarySkillInput`).

### Localization (`packages/localization/src/locales/en.ts` only — `heavy_strike`'s own name/description keys already exist and are already in `REQUIRED_LOCALIZATION_KEYS`; no `LocaleTypes.ts` change needed since `LocalizationKey` is `keyof typeof en`)

- One control-hint key (`world_session.control_skill_primary`) and the same seven-key feedback set tertiary has (`world_area.skill_primary_hit`, `_hit_label`, `_target_missing`, `_target_dead`, `_sent`, `_too_far`, `_on_cooldown`).

---

## Pillar 2: Death in a Combat Zone Sends You Back to Nightmarket

**Goal:** `request_respawn` while `lifeState !== "alive"` in `CombatRoom` no longer resurrects the player in place — it performs the same handoff `request_combat_return` already does (voluntary gate-click return), landing the player back in Nightmarket with full HP, exactly as if they had walked to the gate themselves. `TownRoom`'s own downed/corpse-recovery flow is untouched — this pillar only changes `CombatRoom`.

### Server (`apps/server/src/realtime/rooms/CombatRoom.ts` — `registerRespawnHandler` only)

Replace the current in-place respawn body (`player.hp = player.maxHp; ...; player.x/y = spawn box center; send player_respawned`) with the same sequence `registerCombatReturnHandler` already uses, minus the gate-click-specific interactable lookup:

1. Guard: `player === undefined || player.lifeState === "alive"` → no-op (unchanged gate).
2. Guard: `player.hasPendingAction && player.pendingActionType === "zone_transition"` → no-op (prevents a duplicate handoff if `request_respawn` is sent twice before the client leaves).
3. Resolve the destination the same way the voluntary path does: `resolveCombatZoneReturnSpawnId(state.zoneId)` → `roomContentRegistry.spawnPoints.get(...)`, validated with `isPositionInsideZoneBounds("nightmarket", ...)` — no new coordinate is invented; this is the same generic, zone-agnostic lookup the voluntary return already relies on and already has full content coverage for both combat zones.
4. `setPendingAction(player, { type: "zone_transition", targetId: "combat_death_return", targetX, targetY })` — this is what the `onLeave` guard (Core Build 0.13's position-persistence fix) checks before deciding whether to skip its own persistence, so it must be set before persisting, exactly as the voluntary path does.
5. `await new CharacterService().updateCharacterRoomIntent(player.characterId, "nightmarket", x, y, player.maxHp, player.maxFlaskCharges)` — full HP and full flask charges on arrival, matching the existing respawn's own "full restore" behavior (not a new number; the voluntary return instead preserves current HP/flask, since that path is a live, undefeated player choosing to leave — death is not that, so it keeps respawn's existing full-restore semantics instead of the voluntary path's clamp-current semantics).
6. Send `combat_town_return_approved` (same message type, message text along the lines of "Defeated. Returning to Nightmarket.") — this is the message the client's existing, already-generic `beginTownRoomReturnHandoff` handler already reacts to. **No client protocol/message-handling change is required for this pillar** — `WorldSessionScene.ts`'s `combat_town_return_approved` listener does not know or care whether a gate click or a death triggered it.
7. On failure (`updateCharacterRoomIntent` throws): `clearPendingAction(player)` and fall back to sending nothing new — `request_respawn` failing silently today is the existing behavior for other edge cases in this handler; this build does not add new failure UX beyond what the voluntary path already has for its own failure branch.

### Client (small copy clarity change, not required for function)

- `apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`: the downed panel (`renderHudContent`) already receives `room` and already has `resolveCurrentZoneId`/`resolveZoneKindLabel` helpers (added by Core Build 0.13) for exactly this kind of room-aware copy. When the current zone's `roomType === "combat"`, show a combat-specific hint/button label (new `world_session.downed_respawn_hint_combat` / `world_session.respawn_to_town` keys) instead of the town-flavored "Respawn at safe point." — so the button's actual behavior (you're being sent to town, not healed in place) isn't silently mismatched with copy that used to describe a different mechanic. `handleRespawn()`/`sendRespawnRequest` in `WorldSessionScene.ts` are unchanged — same message, same trigger, only the server-side outcome and the button's own label/hint change.

### Non-numeric confirmation

No new balance constant is introduced: HP-on-arrival reuses the existing "full restore" behavior the in-place respawn already had; the landing position reuses the existing, already-tested `resolveCombatZoneReturnSpawnId` lookup; the handoff message, persistence call, and client room-switch are all pre-existing and unmodified in shape. This is a structural consequence (you leave the zone and must re-enter), not a tuning one.

---

## Verification Strategy

Per `AGENTS.md`'s "Verification Must Be Permanent" rule, every piece of both pillars gets a vitest case in `apps/server/test/`.

**Pillar 1:**

- New test(s) mirroring `apps/server/test/combat/skillSlotCasting.test.ts`'s pattern: cast `slot: "primary"` against an in-range enemy in `CombatRoom`, assert `heavy_strike`'s damage (`3 + (playerDamage - 1)`, using the same `TEST_CHARACTER_STATS` fixture the existing secondary/tertiary tests use) and a `nextReadyAt` cooldown.
- A cooldown round-trip case: cast `primary`, immediately re-cast, assert `skill_on_cooldown`.
- A `TownRoom` case proving the same slot resolves there too (parity with the existing `skillSlotClassResolution.test.ts` pattern) — closing the exact kind of one-room-only gap 0.12 had to fix for dodge/flask.
- Regression-check discipline (per 0.9-0.13's established practice): temporarily revert the slot-literal widen in one handler, confirm the new test for that room fails, then restore.

**Pillar 2:**

- New test mirroring `apps/server/test/town/combatHandoffPositionPersistence.test.ts`'s exact pattern (join `CombatRoom`, force `lifeState` to `"downed"`, send `request_respawn`, await `combat_town_return_approved`, assert `targetZoneId === "nightmarket"` and the persisted `x`/`y` match `resolveCombatZoneReturnSpawnId`'s real spawn point) plus the same "`onLeave` does not double-persist after `client.leave()`" assertion the existing test makes for the voluntary direction — proving the death path is guarded by the same mechanism, not a copy that missed it.
- Regression-check discipline: confirm this new test fails against the *old* in-place-respawn handler body (no `combat_town_return_approved` would ever be sent) before the rewrite, then passes after.

**Full build:**

```bash
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No live dev-server verification is strictly required for Pillar 2 (server-only + one client copy change with no new interaction pattern), but Pillar 1 adds a new client hotkey/input module, so a live manual smoke pass (press `1` near an enemy in both a town and a combat zone, confirm the hit lands and the cooldown/rejection notices show) is planned before calling this build done, per the "test UI changes in a browser" standard for client-facing work.

---

## Core 0.14 Non-Goals

```text
any balance/tuning change to enemy damage, armor, mitigation, or any existing skill's baseDamage/cooldownMs -- explicitly off-limits this build pending a human-set target curve; heavy_strike.range is a unit-correctness fix, not tuning
a persistent HUD cooldown card for the primary slot -- mirrors tertiary's transient-notice-only footprint by design
any change to TownRoom's own downed/corpse-recovery flow -- Pillar 2 only changes CombatRoom's respawn handler
any XP, gold, or item loss on death -- the consequence is purely structural (leave the zone, travel back), not economic
loadout/build choice (letting a player pick their own secondary/tertiary/primary skill) -- still open, not this build
new zones, classes, or enemy types
objectives/quest depth
```

---

## Risks

1. **Pillar 1's schema addition (`nextPrimarySkillSlotAt`) is additive and mirrors an existing, working pattern (`nextTertiarySkillSlotAt`, added in Core 0.7) exactly** — low risk.
2. **Pillar 1 duplicates one small edit across two room files** (`TownRoom.ts`/`CombatRoom.ts`'s inline slot-literal checks) rather than a single shared change — mitigated by both rooms getting explicit test coverage, the same way 0.9's class-resolution fix and 0.12's dodge/flask port were each verified in both rooms independently.
3. **Pillar 2 changes what "Respawn" does from the player's perspective** (no longer an in-place heal) — mitigated by the client copy change (Pillar 2's client section) so the button's label/hint matches its real behavior, and by full HP/flask restore being preserved so the player is not worse off on arrival, only relocated.
4. **A residual chance `CombatRoom`'s free in-place respawn was intentional design, not an oversight** — mitigated the same way 0.12 mitigated the equivalent risk for dodge/flask: the brief itself names "no death/respawn consequence" as an explicitly open, named gap, not a documented decision, and no build doc anywhere states the current free-respawn behavior as a deliberate choice.
5. **Core Build 0.13 must land as its own commit before (or alongside, in build order) 0.14's commit** — this build's own diffs and 0.13's are interleaved in the same working tree (both touch `CombatRoom.ts`, `TownRoom.ts`, and `worldSessionOverlayView.ts`), so committing 0.14 without first separating out 0.13's independent, unrelated changes would misattribute a prior, already-shipped-in-spirit bugfix as part of this build's own work.

---

## Validation Expectations for 0.14 Tasks

```bash
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

Plus a live manual smoke pass for Pillar 1's new client hotkey (see Verification Strategy).

---

## Summary

Core Build 0.14 closes two of the backlog's longest-standing, most-repeatedly-named gaps in one pass: `heavy_strike` — flagged as the natural next step in three prior plans (0.9, 0.11, 0.12) and confirmed bounded once the actual protocol/client touch points were mapped — becomes a real, playable third combat action; and death in a combat zone, which today has zero consequence at all, now reuses the game's own already-correct voluntary town-return handoff to give defeat a real, purely structural cost. Both pillars follow the same discipline 0.9-0.13 established: find something that is a genuine gap (not a design decision), verify that a fix can reuse already-correct logic rather than invent new mechanics or numbers, and prove it with permanent tests in both rooms where parity matters. Balance/tuning remains untouched, per the standing constraint; the one content-value change (`heavy_strike.range`) is a unit-consistency bug fix uncovered during Pillar 1's wiring, not a tuning decision. This build was also the occasion for catching and correctly attributing Core Build 0.13, an undocumented fix found already sitting in the working tree — see `docs/CORE_BUILD_0_13_PLAN.md` for its own record.
