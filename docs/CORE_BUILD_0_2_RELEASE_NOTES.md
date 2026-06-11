# docs/CORE_BUILD_0_2_RELEASE_NOTES.md — Core Build 0.2 Release Notes

## Status

**Release Candidate.** Core Build 0.2 has reached RC status. All 29 committed tasks (285–315) are merged and validated. No new gameplay scope, no new content, no schema changes, no protocol additions.

---

## What's Included

Core Build 0.2 ships 29 tasks (285–315) across six pillar groups. No vendors, stash, waypoints, safe-zone combat enforcement, Vue/app-shell migration, large character customization, large new zone, or class/skill overhaul were added.

---

### 1. Interaction and Move-Then-Act (Tasks 285–288)

**Goal:** Make click-to-move, click-to-attack, click-to-pickup, and click-to-interact feel responsive even when the target is out of range, by having the server queue the action after movement completes.

#### Movement Intent Validation

- **`packages/shared/src/protocol/ClientMessages.ts`**: `RequestMoveClientMessage` with `targetX`, `targetY`, optional `clientTime` — the only accepted movement intent shape
- **`apps/server/src/realtime/rooms/movementIntentValidation.ts`**: `validateMovementIntent()` returns a discriminated `{ ok, targetX, targetY } | { ok: false, reason }` result; never throws
- **`DEFAULT_MOVEMENT_INTENT_BOUNDS`**: Conservative numeric range (not map-aware); real map bounds deferred to later tasks
- Rejection reasons: `"invalid_shape"`, `"non_finite_target"`, `"out_of_range"` — generic across all room types

#### Server-Authoritative Position Stepping

- **`apps/server/src/realtime/rooms/applyMovementIntent.ts`**: `applyMovementIntent()` advances a `PlayerPresence` position on each tick toward the stored target position at `moveSpeed` units/tick
- Server owns position completely; client never directly sets x/y after join
- `PlayerPresence` stores `moveTargetX`, `moveTargetY` — cleared on arrival

#### Deferred Action Queue

- **`apps/server/src/realtime/rooms/deferredActionExecution.ts`**: Queue that stores a pending action (attack, pickup, interact) keyed by `sessionId`. On each tick, if the player is in range of the deferred target, the action fires; otherwise the player continues moving
- Handles: `request_attack`, `request_pickup_world_loot`, `request_interact`
- Prevents duplicate queue entries; clears queue on new movement or dodge

#### Dodge Intent

- **`apps/server/src/realtime/rooms/dodgeIntent.ts`**: Validates and applies dodge direction from client intent; server-authoritative cooldown and position delta

#### Approach Target Resolution

- **`apps/server/src/realtime/rooms/resolveApproachTarget.ts`**: Finds the nearest valid position to approach a target entity or position for move-then-act

**Client wiring**: `WorldSessionScene.ts` — `sendMovementIntent()` is the only sanctioned client path for `request_move`; wire-through for attack/loot/interact goes through the deferred queue

**No movement simulation, no pathfinding, no collision detection, no map/entity placement, no combat formula changes.**

---

### 2. Content/Data Hardening (Tasks 289–293, 296, 305)

**Goal:** Replace hardcoded zone/interactable/content branches with data-driven content-registry lookups. Harden validation so content errors fail CI early rather than silently producing wrong behavior.

#### Content Registry Validation (Task 289)

- **`packages/content/src/ContentValidation.ts`**: Comprehensive validation of all content registry definitions:
  - Zone validation (bounds, type, spawn zones within bounds, world props within bounds)
  - World prop validation (kind, zone binding, label key existence)
  - Enemy validation (stats, attack cooldown minimums)
  - Item validation (category, rarity, stack limits, slot compatibility)
  - Loot table validation (entries sum to 100, referenced items/enemies exist)
  - Vendor stock validation (referenced items exist)
  - Objective validation (zone ID presence when set)
  - Spawn point validation (zone binding exists)
  - Rest area bounds validation (finite numbers, min < max, contained within zone)
- Missing/invalid references produce clear error messages with content IDs

#### Remove Nightmarket-Specific Town Interactable Hardcoding (Task 290)

- **`apps/server/src/realtime/rooms/initializeTownInteractables.ts`**: Rewritten to filter `contentRegistry.worldProps.all` by `zoneId` and interactable-relevant `kind` values — no more `if (zoneId === "nightmarket")` branch
- Notice board ID updated from `"nightmarket_notice_board"` to `"nightmarket_notice_board_01"` to match world prop definition
- Any zone with matching prop definitions (`town_service`, `vendor`, `waypoint`, `loot_container`) gets interactables populated automatically

#### Replace Hardcoded `"nightmarket"` Zone Fallback (Task 291)

- **`apps/server/src/realtime/rooms/resolveTownZoneId.ts`**: New helper resolving town zone ID from `contentRegistry.zones` instead of `options.requestedZoneId ?? ("nightmarket" as ZoneId)`
- Data-driven: adding a new town zone to `zones.ts` automatically surfaces through the resolver

#### Remove Client Display Fallback Hardcoding (Task 292)

- **`apps/client/src/net/RealtimeClient.ts`**: `formatTownRoomState()` now uses neutral `"unknown"` fallback instead of hardcoded `"nightmarket"`; `zoneId` derived from `state.zoneId`

#### First 0.2 Content Slice (Task 293)

- **Ambient sewer rats** (`nightmarket_rat_01`, `nightmarket_rat_02`) added between service cluster and Skitter Warren
- **`tarnished_coin`** item — common stackable material (1×1, max stack 99), ~8% drop chance from sewer runts/skitters/brutes via loot table weight adjustments
- No gameplay system changes; existing loot/inventory/combat unchanged

#### Localization Key Support for World Prop Labels (Task 296)

- `labelKey?: ContentLocalizationKey` added to `WorldPropContentDefinition`
- 31 English locale keys added for all player-facing prop labels
- `resolvePropLabel()` helpers on both client and server resolve labels through localization layer with `label` fallback
- Content validation checks `labelKey` existence in English locale

#### Rest Bounds + Area Banner Hardening (Task 305)

- Rest area bounds validation: finite numbers, `minX < maxX`, `minY < maxY`, contained within zone bounds
- Area banner: safe `zoneId` handling, timer cleanup on destroy, teardown in scene shutdown/destroy
- Rest area detection: safe `null` return for missing zone/bounds
- Floating "Rest Area" label cleared to empty string on destroy

**No schema/database changes, no gameplay system changes, no new content except the rats and tarnished_coin.**

---

### 3. World Readability (Tasks 294–295, 298, 309)

**Goal:** Make the Nightmarket world easier to understand at a glance — where the edges are, where the safe area is, what zone you're in, and where ground loot is.

#### Boundary Markers (Task 294)

- **`"boundary_marker"`** world prop kind added — renders as dark brown barricade rectangles with no label
- 22 markers along all four edges of the (0,0)–(5000,3600) playable area
- Visual only; no collision, pathfinding, or combat enforcement

#### Safe-Area Ring Markers (Task 295)

- **`"safe_area_marker"`** world prop kind added — renders as green ring with inner dot
- 8 markers forming a hexagonal ring around the Nightmarket service cluster; 2 at entrances carry a "Safe Area" label
- Visual only; no combat enforcement

#### Area Name Banner (Task 298)

- **`worldSessionAreaBannerView.ts`**: Diablo-like top-center location name banner with fade animation (~600ms fade in, ~2400ms hold, ~600ms fade out)
- Zone display name resolved from content registry + localization layer
- `pointer-events: none` ensures no input blocking
- Cleaned up on scene teardown

#### Ground Loot Readability Polish (Task 309)

- Y-sorted depth for loot containers (300 + y) — renders above props but below enemies/player
- Y-sorted depth for corpse markers (350 + y)
- Loot label font increased 13→14px, background alpha 0.82→0.88, brighter border, larger glow/ping ellipses with increased opacity
- Defeated enemy labels: `"Label [Defeated]"` (bracket notation) instead of `"Label • Defeated"`; dimmed to `#999999` to reduce visual competition with loot

#### Depth Layering

```text
Static props:     no explicit depth (Phaser default 0)
Loot:             300 + y
Corpse markers:   350 + y
Enemies:          400 + y
Player:           500 + y
```

**No collision, pathfinding, combat, loot system, inventory, or zone data changes.**

---

### 4. Town/Rest-Area Polish (Tasks 299, 302–305)

**Goal:** Make town entry and the rest area inside the service cluster feel responsive and informative — HP/flask restore on entry, a physical replenish zone with enter/exit feedback, and no spam.

#### Town Rest Refill on Join (Task 299)

- **`townRestRefill.ts`** (`applyTownRestRefill`): Restores `hp` to `maxHp`, resets flask charges and cooldown on town entry
- Called in `TownRoom.onJoin()` after `buildTownPlayerPresence()` loads persisted values
- Sends `town_rest_refill` message to joining client for localized feedback
- Documented that future class-specific resources should be restored here

#### Rest Refill Trigger Audit (Task 302)

- Confirmed refill runs once on `TownRoom.onJoin()` — no code behavior changes
- Docs clarified: current behavior is join-only; future physical-replenish-area is separate
- Redundant `restoreFlaskToFull` in `buildPlayerPresence` documented as intentional (guarantees full flasks on spawn regardless of refill ordering)

#### Physical Town Rest Area (Task 303)

- **`restAreaBounds`** on `ZoneContentDefinition` (`minX, maxX, minY, maxY`)
- Nightmarket zone: `restAreaBounds: { minX: 40, maxX: 540, minY: 80, maxY: 480 }` covering the service cluster
- **`townRestAreaTrigger.ts`**: `applyTownRestAreaRefill()` and `applyTownRestAreaRefillForAll()` — checks if player is inside bounds and alive, calls `applyTownRestRefill` only when conditions are met
- Wired into `TownRoom` simulation tick (50ms) after movement, aggro, and respawn
- Spam prevention: `applyTownRestRefill` returns `changed: false` when already full
- 5 `rest_area_marker` props added (teal double-ring visual)

#### Rest Area Visual Feedback (Task 304)

- **`townRestAreaDetection.ts`**: Client-side check for rest area bounds (visual only; does not duplicate server refill logic)
- **`worldSessionAreaView.ts`**: Enter/exit tracking with one-time localized notices ("Rest Area — Replenishing" / "Left Rest Area")
- Persistent teal "Rest Area" label above player while inside (Phaser text object, no `pointer-events` concerns)
- No message spam — fires only on state transitions

**No mana/resource system, no safe-zone combat enforcement, no rest shrine UI panel, no vendor/stash/waypoint changes.**

---

### 5. Combat/Readability Polish (Tasks 300–301, 306, 310–312)

**Goal:** Make player damage, enemy attack windups, loot pickup failures, and keyboard input more readable and reliable without changing combat formulas, AI, or systems.

#### Full-Inventory Pickup Rejection (Task 300)

- Server audit confirmed `pickupWorldLootDispatcher.ts` maps refusal to `"inventory_full"` reason; `pickupWorldLootInventory.ts` returns `{ ok: false, reason: "inventory_full" }`
- **Fix:** Removed redundant `interact_response` hardcode in `deferredActionExecution.ts` that was sending duplicate English strings alongside the proper typed rejection message
- Client `WorldSessionScene.ts` already routes `"inventory_full"` to `t("world_area.inventory_full")` → "Inventory full."

#### Keyboard Shortcut Focus Guard (Task 301)

- All gameplay hotkeys (Space/dodge, Q/flask, +/-/zoom, numpad zoom) now skip when focus is inside editable UI elements
- `shouldIgnoreWorldSessionCombatHotkey()` checks `document.activeElement` against input/textarea/select/contenteditable
- Zoom +/-/numpad were the remaining unguarded hotkeys; dodge and flask were already guarded

#### Combat Feel Tuning (Task 306)

- **Player attack cadence:** Formula base reduced 1100→1000 → ~925ms at starting stats (was ~1025ms); 500ms floor unchanged
- **Default fallback:** `DEFAULT_ATTACK_COOLDOWN_MS` reduced 700→600ms
- **Enemy attack cooldowns:** Runt 1180→1050ms, Brute 980→850ms, Skitter 1100→980ms
- **Enemy attack windup:** `ENEMY_ATTACK_WINDUP_MS` reduced 350→300ms in both TownRoom and CombatRoom
- No damage formula, AI, ability, or system changes — server remains authoritative

#### Hit and Damage Feedback (Task 310)

- **Enemy hit flash:** 120ms white-tint tween on enemy body, triggered exclusively by `request_attack_accepted`, `request_use_skill_slot_accepted`, and `damage_applied` server messages
- **Floating damage numbers:** Float-up + fade tween (700ms lifetime, 22px upward, `Cubic.easeOut`)
- **Scene wiring:** `damage_applied` routed to enemy or player visual via `isEnemyEntityId()` check; `"Hit!"` indicator on attack accepted

#### Player Damage and Death Readability (Task 311)

- **Player damage flash:** 220ms red-tint overlay on player body (0.65→0 alpha, `Cubic.easeOut`); preserves base visual state
- **Camera shake:** 180ms at 0.008 intensity on downed state
- **Own corpse marker:** Teal pulsing glow (1×↔1.3×, 0.18↔0.45 alpha), slightly larger and brighter than other corpses, "Click to recover" prompt below
- No death mechanic, combat formula, or recovery rule changes

#### Enemy Attack Windup Readability (Task 312)

- **Body/ring tint:** Amber (`#ffaa22`) for normal attacks, hot red (`#ff3a10`) for heavy attacks
- **Pulsing glow tween:** 1.0↔1.08 scale, 130ms normal / 160ms heavy cycle, `Sine.easeInOut`
- **"INCOMING"/"INCOMING!"** label above enemy during windup — amber for normal, warm orange for heavy
- All visuals driven by `enemy_attack_telegraph` / `enemy_attack_resolved` server messages
- No AI, combat formula, ability, or schema changes

**No fake client-side combat authority, no new abilities, no animation system rewrite.**

---

### 6. World Cursor Target Feedback (Task 314)

**Goal:** Improve WorldSession input readability by showing what the cursor is pointing at, with color-coded hover labels and subtle highlight rings on targets.

#### Hover Label

- **`worldSessionCursorFeedback.ts`**: New module with a lightweight Phaser text object updated only on `POINTER_MOVE`
- Shows `[Attack] EnemyName`, `[Pick up]`, `[Interact]`, `[Recover corpse]`, or `[Move]` depending on what's under the cursor
- Color-coded per type: red for enemies, gold for loot, beige for interactables, teal for own corpse, muted for ground
- Small arrow indicator (▼) below the label for visual clarity
- No per-frame object creation or destruction — only text/setStyle/visibility calls

#### Highlight Rings

- **Enemy hover:** Amber glow ring (`#ffcc44`) around the enemy body, suppressed on defeated enemies
- **Loot hover:** Gold outline ring around the loot item, separate from the existing pending-pickup ring
- **Own corpse hover:** Hover label shown when cursor is over the own corpse marker; no separate highlight ring needed (corpse already has pulsing glow from Task 311)
- All highlight feedback is toggled via visibility on pre-existing Phaser objects — no object churn

#### Hover Priority (matches click priority)

```
1. Enemy (living) → [Attack]
2. Loot → [Pick up]
3. Own corpse → [Recover corpse]
4. Interactable → [Interact]
5. Ground (debug_top_down only) → [Move]
```

#### Integration

- `resolveHoverTarget()` in `worldSessionAreaView.ts` reuses the same `findClickedEnemy`/`findClickedWorldLoot`/`findClickedOwnCorpse`/`findClickedInteractable` hit-test helpers as the click handlers, guaranteeing hover feedback matches click priority
- Enemy hover highlight is managed through the existing `hoveredEnemyId` tracking variable with `setHovered()` calls on the enemy placeholder view
- All cursor feedback updates happen inside the already-registered `POINTER_MOVE` handler — no new listeners, no per-frame churn
- `setDepth(10_000)` ensures hover label renders above all world elements
- Existing click behavior, interaction intent, move-then-act, dodge, flask, combat, loot, inventory, equipment, zoom, and rest area behavior remain completely unchanged

**No schema/database changes, no protocol additions, no gameplay system changes.**

---

### 7. Performance Fixes (Tasks 307–308)

**Goal:** Eliminate progressive FPS degradation during extended WorldSession play and guard against regression.

#### WorldSession Lag Fix (Task 307)

Root causes identified and fixed:

1. **Event listener churn (~60fps):** `inputZone.removeAllListeners()` + POINTER_DOWN/MOVE/UP re-registration was inside `refreshFromRoomState()`, called from the Phaser UPDATE loop every frame
2. **Per-frame Phaser object destroy/recreate:** `staticPropsView.refresh()` and `interactablesView.refresh()` destroyed and recreated all Phaser objects every frame, causing extreme GC pressure
3. **Unnecessary graphics redraw:** `drawViewportFrame()` and `drawBounds()` redrew every frame despite never changing

**Fix applied:**
- Input handler registration moved OUT of `refreshFromRoomState()` to run ONCE during setup; handlers read current projection/offset from module-scope variables
- `roomStateDirty` flag added; expensive rebuilds only run when Colyseus state changes, zoom changes, projection mode changes, or pickup target updates
- `refreshFromRoomState(room)` removed from per-frame UPDATE loop; now only runs on `room.onStateChange`
- Per-frame loop handles only lightweight operations (held movement throttle, pending range checks)

#### Guardrails Against Regression (Task 308)

- Structured section comments (`[A]` projection, `[B]` dirty rebuild, `[C]` entity processing, `[D]` player position) inside `refreshFromRoomState()`
- `roomStateDirty` flag documented with all setters and explicit statement that UPDATE loop must not read it
- Input handler registration documented as one-time-only with `GUARD` warning
- Per-frame UPDATE handler comment block listing allowed vs. forbidden operations
- All changes are comment-only; no runtime behavior changed

**No gameplay, combat, movement, loot, or UI changes — pure performance + maintainability.**

---

### 8. Reconnect and Phantom Presence Cleanup (Task 315)

**Goal:** Audit and harden reconnect/leave behavior so players do not leave phantom presence entries, duplicate message handlers, stale overlays, or stale room state behind after refresh/re-enter.

#### Server-Side Leave Cleanup

- **TownRoom.onLeave** now clears any enemy that was targeting the leaving player via `clearEnemyTargetAndReturn`, preventing enemies from chasing a stale session ID after disconnect/refresh. This was already present in `CombatRoom.onLeave` but was missing in `TownRoom`.
- Enemy combat state (`nextAttackAtMs`, `attackLandingAtMs`, `targetPlayerSessionId`) is reset so the enemy returns to spawn and becomes available for re-acquisition by remaining players.
- Existing behavior preserved: HP/location/flask persistence on leave via `CharacterService.updateCharacterLocation`, player presence removal, and `connectedPlayerCount` update.

#### Client Scene Teardown Fix

- **WorldSessionScene.handleSceneTeardown** now nulls `this.room` and `this.account` before destroying child views, so any pending `onStateChange`/`onMessage` callbacks that fire during or after teardown see a null guard and skip rendering. This prevents phantom overlays or stale DOM elements from appearing after leaving or re-entering WorldSession.
- All existing cleanup (dodge input, healing flask input, feedback view, vendor panel, town service panel, area banner, world area view, overlay) remains unchanged and runs after the null guards are set.
- Existing behavior preserved: leave button, Enter World, reconnect, movement, combat, move-then-act, loot pickup, rest area, area banner, cursor feedback, inventory, zoom, and all other gameplay remain unaffected.

#### Files Changed

- `apps/server/src/realtime/rooms/TownRoom.ts` — added enemy target cleanup in `onLeave`
- `apps/client/src/game/scenes/WorldSessionScene.ts` — added null guards in `handleSceneTeardown`

**No schema/database changes, no protocol additions, no gameplay system changes, no save-system redesign, no death/corpse mechanic changes.**

---

## Validation Status

- `pnpm validate:0.1` — passing (same known warnings as 0.1 RC)
- `pnpm validate:0.2` — passing
- `pnpm lint` — passing
- `pnpm typecheck` — passing
- `pnpm build` — passing

All committed tasks (285–315) have been merged and manually validated per checklist tracking. See `docs/CORE_BUILD_0_2_CHECKLIST.md` for per-task validation and doc status.

---

## RC Status — No True Blockers Remain

The following former RC blocker candidates have been resolved by committed 0.2 tasks and are no longer blockers:

| Resolved Issue | Resolving Task | Notes |
|----------------|----------------|-------|
| Cursor feedback (hover labels / highlight rings) | 314 | Cursor target feedback shipped with color-coded hover labels and highlight rings |
| Reconnect / phantom presence cleanup | 315 | Server-side `onLeave` enemy target release + client scene teardown null-guards |
| Lag over time (progressive FPS degradation) | 307 | Event listener churn, per-frame object rebuild, and unnecessary redraws eliminated |

**No true RC blockers remain.** The items below are non-blocking polish that do not prevent RC declaration. They are tracked for future grooming:

| Priority | Issue | Pillar | Notes |
|----------|-------|--------|-------|
| Medium | Camera smooth follow (lerp or dead zone tweaks) | 5 | Camera follows player instantly; subtle smoothing would improve feel |
| Low | Zoom range clamp review | 5 | Verify zoom extremes don't clip into void or lose readability |
| Low | Orphaned loot cleanup on client disconnect | 4 | Loot drops from a disconnecting player's kills remain on the ground until timer expiry; no active cleanup on disconnect |
| Low | Content registry validation unit tests in CI | 6 | Currently validated via `pnpm validate:0.2` but not in automated test suite |
| Low | Spawn zone & loot table test coverage | 6 | No automated tests for content correctness |

---

## RC Summary

### What Changed Since Core 0.1

Core Build 0.2 delivers 29 tasks over the stable 0.1 RC baseline, focused on interaction feel, content/data hardening, world readability, town/rest-area polish, combat readability, cursor feedback, performance fixes, and reconnect hardening. Key changes:

- **Move-then-act** — server-authoritative movement intent, position stepping, deferred action queue, dodge intent, and approach target resolution let click-to-attack/pickup/interact feel responsive even when out of range
- **Content/data pipeline hardened** — comprehensive content registry validation, all Nightmarket-specific hardcoding removed, first content slice (ambient rats + `tarnished_coin`), localization key support for world prop labels
- **World readability** — boundary markers, safe-area ring markers, area name banner, y-sorted depth layering, improved ground loot labels
- **Town/rest-area polish** — HP/flask restore on town entry, physical rest area with server tick refill, enter/exit feedback with no spam
- **Combat readability** — full-inventory pickup rejection, keyboard shortcut focus guard, combat feel tuning (faster attack cadence), hit flash + floating damage numbers, player damage/death flash + camera shake, enemy attack windup telegraph visuals
- **Cursor target feedback** — color-coded hover labels (`[Attack]`, `[Pick up]`, `[Interact]`, `[Recover corpse]`, `[Move]`), enemy/loot highlight rings
- **Performance fix** — WorldSession lag eliminated (event listener churn, per-frame object rebuild, unnecessary redraws)
- **Reconnect cleanup** — phantom presence cleanup on `TownRoom.onLeave`, scene teardown null-guards preventing stale overlays

### What Is Explicitly Not Included

- Vendors (buy/sell behavior)
- Stash (storage functionality)
- Waypoints (functional travel)
- Safe-zone combat enforcement (visual markers only)
- Vue/app-shell migration
- Large character customization (avatarKey from defaults only)
- Large new zone (Nightmarket only)
- Class/skill overhaul
- Mana/class resource system

### Known Non-Blocking Limitations

- Camera follows player instantly; subtle smoothing would improve feel (medium)
- Zoom range clamp review at extremes (low)
- Orphaned loot not cleaned up on client disconnect (low)
- Content registry validation runs via `pnpm validate:0.2` but not in automated CI test suite (low)
- Spawn zone and loot table coverage lack automated tests (low)
- Core 0.1 smoke checklist re-test not yet run (optional)

---

## Deferred to 0.3 (Non-Blocking)

These items are explicitly **out of scope for 0.2 RC**. They will not block the release and should be tracked for backlog grooming:

- **Vendors** — no buy/sell behavior; vendor stock entries exist as content data only
- **Stash** — stash keeper placed in world but has no storage functionality
- **Waypoints** — waypoint world prop exists but is non-functional
- **Safe-zone combat enforcement** — safe-area markers are visual only; no combat suppression
- **Vue/app-shell migration** — not started; Phaser-only client remains
- **Large character customization** — avatarKey from predefined defaults only; no customization UI
- **Large new zone** — no new zones beyond the Nightmarket
- **Class/skill overhaul** — no new classes, skills, or resource system (mana/rage/etc.)
- **Mana/class resource system** — flask charges are the only resource; no mana bar or class-specific resource

---

## Previous Baseline

Core Build 0.2 builds on the stable 0.1 RC baseline. All 0.1 features (auth, character creation, basic combat, loot, inventory, equipment, death/corpse recovery, TownRoom, CombatRoom, Nightmarket world) remain unchanged in architecture. See `docs/CORE_BUILD_0_1_RELEASE_NOTES.md`.