# docs/CORE_BUILD_0_2_RELEASE_NOTES.md — Core Build 0.2 Release Notes

## Status

**In Development.** Core Build 0.2 active development has begun from the stable 0.1 RC baseline.

---

## What's Included

### Task 284 — Development Baseline

- 0.2 marked as active development in planning docs
- First task row added to checklist
- `pnpm validate:0.2` script added (same checks as 0.1; will diverge as 0.2 work accumulates)
- Previously fixed UI/input/reconnect/loot/enemy reliability issues documented as regression-watch items (not active blockers)
- First 0.2 implementation lane defined: **Lane 1 — UI / Input Reliability** (Pillar 1)

### Task 290 — Remove Nightmarket-Specific Town Interactable Hardcoding

- `apps/server/src/realtime/rooms/initializeTownInteractables.ts`: Rewritten to filter `contentRegistry.worldProps.all` by `zoneId` and interactable-relevant `kind` values, removing the hardcoded `if (zoneId === "nightmarket")` branch
- `apps/server/src/realtime/rooms/interactValidation.ts`: Updated notice board ID from `"nightmarket_notice_board"` to `"nightmarket_notice_board_01"` to match the world prop definition
- `apps/server/src/realtime/rooms/TownRoom.ts`: Updated notice board reference `"nightmarket_notice_board"` to `"nightmarket_notice_board_01"`
- `docs/TECH_DEBT.md`: Marked the hardcoded Nightmarket interactable item as resolved
- Nightmarket town interactables still appear/work as before
- The new path is zone-driven: any zone with matching world prop definitions (`town_service`, `vendor`, `waypoint`, `loot_container`) gets its interactables populated automatically

### Task 291 — Replace Hardcoded `"nightmarket"` Zone Fallback in TownRoom

- `apps/server/src/realtime/rooms/resolveTownZoneId.ts`: New helper module that resolves town zone ID from `contentRegistry.zones`, replacing the earlier `options.requestedZoneId ?? ("nightmarket" as ZoneId)` pattern
  - If `requestedZoneId` is provided and exists as a `town`-type zone, returns it
  - If no `requestedZoneId` is provided, falls back to the first registered town-type zone from content  - Unknown or wrong-room-kind zones are rejected with a safe error
  - This is data-driven: adding a new town zone to `zones.ts` automatically surfaces through the resolver
- `apps/server/src/realtime/rooms/TownRoom.ts`: Replaced `options.requestedZoneId ?? ("nightmarket" as ZoneId)` with `resolveTownZoneId(options.requestedZoneId)` 

### Task 292 — Remove Client Town Room Display Fallback Hardcoding

- `apps/client/src/net/RealtimeClient.ts`: Replaced hardcoded `"nightmarket"` fallback in `formatTownRoomState()` with neutral `"unknown"` fallback
  - `zoneId` is now derived from `state.zoneId` (from `RoomState`) with a safe `"unknown"` default for missing/empty values
  - Nightmarket display remains unchanged when the server provides a valid `zoneId`
  - Invalid/missing display data now degrades predictably without pretending a specific zone
- `docs/TECH_DEBT.md`: Marked the client-side `formatTownRoomState()` hardcoded fallback as resolved

### Task 293 — Add First Small 0.2 Content Slice

First content-driven gameplay/world addition using the hardened content pipeline, proving the data-first approach works in practice.

- **New world props** (`packages/content/src/data/worldProps.ts`):
  - Added 2 ambient sewer rat props (`nightmarket_rat_01`, `nightmarket_rat_02`) between the service cluster and Skitter Warren, filling a gap in the path where no props existed
  - Uses the existing `ambient_rat` world prop kind — no new kinds or types added
- **New item** (`packages/content/src/data/items.ts`):
  - `tarnished_coin` — a new common stackable material (1×1, max stack 99)
  - Drop flavor: "A corroded coin stamped with a face nobody remembers. Still clinks when dropped."
  - Uses existing `material` category, `common` rarity, no stat modifiers
- **Loot table updates** (`packages/content/src/data/lootTables.ts`):
  - `sewer_starter_loot`: `tarnished_coin` added with weight 8 (of 100), giving it an ~8% drop chance from sewer runts/skitters
  - `sewer_brute_loot`: `tarnished_coin` added with weight 8 (of 100), same drop chance from brutes
  - Runt/skitter `blackwire_scrap` weight reduced from 68→60 to make room while keeping total at 100
- **Localization** (`packages/localization`):
  - `item.tarnished_coin.name` and `item.tarnished_coin.description` added to English locale
  - Added to `REQUIRED_LOCALIZATION_KEYS` in `LocaleTypes.ts`
- **No gameplay system changes**: existing enemy drops, combat, inventory, and equipment behavior remain unchanged; the tarnished_coin is simply another material that rolls through the existing loot system
- **No schema/database changes**: no Prisma migration required
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass (0 errors, same 2 pre-existing warnings)

### Task 294 — Add Basic World Boundary Readability Pass

Added data-driven boundary marker props to clarify world edges and the Nightmarket (0,0)→(5000,3600) playable area. No collision, pathfinding, combat, or system changes.

- **New world prop kind** (`packages/content/src/data/types.ts`):
  - `"boundary_marker"` added to `WorldPropKind`
  - Renders as a simple wall/high-barrier placeholder (brown/grey rectangles) with no label text
  - No localization keys needed — boundary markers are label-free visual cues

- **Validation support** (`packages/content/src/ContentValidation.ts`):
  - `"boundary_marker"` added to `VALID_WORLD_PROP_KINDS` for content validation

- **World props data** (`packages/content/src/data/worldProps.ts`):
  - 22 boundary marker props added along all four edges:
    - 7 north edge markers (y≈60, from x=400 to x=4600)
    - 5 east edge markers (x≈4900, from y=500 to y=2900)
    - 6 south edge markers (y≈3500, from x=600 to x=4600)
    - 4 west edge markers (x≈60, from y=800 to y=3200)
  - Service cluster area (x≈150-420, y≈180-380) remains free of boundary markers
  - Combat zones (y≈1050-2700) remain unaffected
  - All markers use empty label strings — no localization keys required

- **Client rendering** (`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`):
  - `boundary_marker` case added to prop renderer
  - Renders as a simple1 barricade shape (dark brown rectangles with stroke, no label)
  - Boundary markers do not add a label text element (label-free by design)
  - No z-ordering changes; boundary markers sort by y with other props

- **No schema/database changes**: no Prisma migration required
- **No collision/pathfinding**: boundary markers are visual only; no enforcement
- **No new hostile enemies in tow/service cluster**: existing spawn zones unchanged
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

### Task 295 — Add Town Safe-Area Content Boundary Markers

Added a small data-driven visual ring of `safe_area_marker` props around the Nightmarket service/town cluster to make the safer hub area more readable at a glance. No combat enforcement, no system changes.

- **New world prop kind** (`packages/content/src/data/types.ts`):
  - `"safe_area_marker"` added to `WorldPropKind`
  - Renders as a subtle green ring with a small inner dot; two markers at north/south entrances also carry a `"Safe Area"` label text in green

- **Validation support** (`packages/content/src/ContentValidation.ts`):
  - `"safe_area_marker"` added to `VALID_WORLD_PROP_KINDS` for content validation

- **World props data** (`packages/content/src/data/worldProps.ts`):
  - 8 safe-area marker props forming a hexagonal ring around the service cluster:
    - 6 perimeter points at roughly (130,110), (440,110), (530,280), (440,460), (130,460), (40,280)
    - 2 labelled "Safe Area" text markers at north (290,90) and south (290,480) entrances
  - Service cluster props (x≈150-420, y≈180-380) remain inside the ring
  - All enemy spawn zones (Skitter x≈1500+, Runt x≈1750+, Brute x≈2600+) remain well outside the safe ring

- **Client rendering** (`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`):
  - `safe_area_marker` case added to prop renderer
  - Renders as a green ring (`#5a9e5a`, 45% stroke + 8% fill, radius 14) with a small green inner dot (`#7ab87a`)
  - Label text rendered in green (`#7ab87a`) when non-empty; label-free markers (the 6 perimeter points) show only the ring/dot graphic
  - No z-ordering changes; safe-area markers sort by y with other props

- **No schema/database changes**: no Prisma migration required
- **No combat enforcement**: markers are visual only; no safe-zone combat rules
- **No pathfinding/collision changes**: existing movement unchanged
- **Enemy spawn zones unchanged**: Runt (1750-2150, 1300-1750), Skitter (1500-1780, 1050-1350), Brute (2600-3200, 2100-2700) all remain outside the service cluster
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

### Task 296 — Move World Prop Labels Toward Localization Keys

Reduced hardcoded player-facing world prop labels by adding `labelKey` support and English locale keys for all visible prop text.

- **Type update** (`packages/content/src/data/types.ts`):
  - Added optional `labelKey?: ContentLocalizationKey` to `WorldPropContentDefinition`
  - Existing `label: string` kept as fallback for backward compatibility

- **Localization keys** (`packages/localization/src/locales/en.ts`):
  - 31 new `world_prop.*` locale keys added for all player-facing world prop labels:
    - Area labels: `world_prop.area.nightmarket_services.label`, `world_prop.area.sewer_approach.label`, `world_prop.area.skitter_warren.label`, `world_prop.area.blackwire_sewer_edge.label`, `world_prop.area.deep_sewer_edge.label`
    - Safe area: `world_prop.safe_area.label`
    - Town services/interactables: `world_prop.notice_board.label`, `world_prop.suspicious_vendor.label`, `world_prop.stash_keeper.label`, `world_prop.trainer.label`, `world_prop.waypoint.label`
    - Props/crates/junk: `world_prop.market_crates.label`, `world_prop.crate.label`, `world_prop.market_junk.label`, `world_prop.lamp.label`, `world_prop.roadside_crates.label`, `world_prop.abandoned_cart.label`, `world_prop.abandoned_crates.label`, `world_prop.crates.label`, `world_prop.junk.label`, `world_prop.scrap_pile.label`
    - Ambient creatures: `world_prop.pig_neutral.label`, `world_prop.sewer_rat_neutral.label`, `world_prop.chicken_neutral.label`
    - Combat edges: `world_prop.edge_skitter.label`, `world_prop.edge_blackwire_sewer.label`, `world_prop.edge_blackwire_deep.label`
    - Debris: `world_prop.sewer_rubble.label`, `world_prop.sewer_edge_debris.label`, `world_prop.skitter_refuse.label`, `world_prop.deep_rubble.label`
  - All new keys added to `REQUIRED_LOCALIZATION_KEYS` in `LocaleTypes.ts`

- **World props data** (`packages/content/src/data/worldProps.ts`):
  - All props with non-empty player-facing labels now carry a `labelKey` reference
  - Boundary markers and path markers remain label-free (no `labelKey`)
  - `label` strings preserved as fallback values

- **Content validation** (`packages/content/src/ContentValidation.ts`):
  - World prop validation now checks that any present `labelKey` exists in the English locale
  - Missing `labelKey` values are reported as validation errors

- **Client rendering** (`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`):
  - Added `resolvePropLabel()` helper that resolves display text from `labelKey` via `en` locale lookup, falling back to `label` when no `labelKey` is present
  - Both standard prop labels and area label decorations use the resolver

- **Server interactable init** (`apps/server/src/realtime/rooms/initializeTownInteractables.ts`):
  - Added `resolvePropLabel()` helper matching the client pattern
  - Interactable `label` synced to Colyseus clients now uses the locale-resolved string

- **No schema/database changes**: no Prisma migration required
- **No gameplay system changes**: existing props, rendering, and interaction behavior remain visually identical
- **Boundary markers remain label-free**: no localization keys for boundary or path markers
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

### Task 298 — Add Area Name Banner on Zone/Town Entry

Added a Diablo-like top-center location name banner that appears when the player enters a town or gameplay zone.

- **New banner view** (`apps/client/src/game/scenes/worldSession/worldSessionAreaBannerView.ts`):
  - `createWorldSessionAreaBannerView()` creates a fixed-position DOM element at top-center of the screen
  - Banner resolves the zone display name from the content registry (`contentRegistry.zones.get(zoneId)`) and the localization layer (`t(nameKey)`), with a title-case fallback for unknown zone ids
  - CSS transition-driven fade animation: fade in (~600ms), hold (~2400ms), fade out (~600ms)
  - `pointer-events: none` on the root element ensures the banner never blocks world input (clicks pass through to the Phaser canvas)
  - Banner is cleaned up on scene teardown

- **Scene integration** (`apps/client/src/game/scenes/WorldSessionScene.ts`):
  - `showAreaBanner()` reads `room.state.zoneId` and triggers the banner on scene `create()`
  - Banner view instance is tracked and destroyed during scene teardown

- **No schema/database changes**: no Prisma migration required
- **No gameplay system changes**: movement, combat, loot, interactables, inventory, and zoom remain unchanged
- **No hardcoded zone names**: display name comes from the content registry + localization layer
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

### Task 299 — Add Town Rest Refill Foundation

Added server-authoritative town-rest refill: HP and healing flask charges are restored to maximum when the player enters a valid town zone (Diablo-like rest-in-town behavior).

- **New server helper** (`apps/server/src/realtime/rooms/townRestRefill.ts`):
  - `applyTownRestRefill(player: PlayerPresence)`: Evaluates current HP and flask state, restores `player.hp` to `player.maxHp`, and calls `restoreFlaskToFull()` (existing helper) to reset charges, maxCharges and cooldown
  - Returns `{ restoredHp, restoredFlaskCharges, changed }` so callers can decide whether to send feedback
  - Mutates the PlayerPresence in-place; Colyseus schema sync broadcasts the restored values automatically
  - Documented that future class-specific resources should be restored here once those systems exist

- **TownRoom integration** (`apps/server/src/realtime/rooms/TownRoom.ts`):
  - Imports `applyTownRestRefill` and calls it in `onJoin()` after `buildTownPlayerPresence()` (so persisted partial values are already loaded) and before inserting into the presence map
  - If the refill actually changed state (`changed === true`), sends a `town_rest_refill` message to the joining client for localized feedback
  - No schema or database changes; persistence of the restored values already happens through the existing `onLeave` flow

- **New server message** (`packages/shared/src/protocol/ServerMessages.ts`):
  - `TownRestRefillServerMessage { type: "town_rest_refill", restoredHp, restoredFlaskCharges }` — added to `ServerRoomMessage` union

- **Localization** (`packages/localization`):
  - `world_session.town_rest_refill`: "Restored in town. HP and flask charges replenished."
  - Added to `REQUIRED_LOCALIZATION_KEYS` in `LocaleTypes.ts`

- **Client feedback** (`apps/client/src/game/scenes/WorldSessionScene.ts`):
  - Listens for `town_rest_refill` and displays the localized notice via `feedbackView.showNotice()`
  - Explicitly documented that the synced schema state is the source of truth; this is just notification text

- **Tech debt** (`docs/TECH_DEBT.md`):
  - Recorded that `applyTownRestRefill` currently handles only HP and flask charges; future class resources should be restored here

- **No mana/resource system**: no fake mana behavior introduced
- **No safe-zone combat enforcement**: markers remain visual only
- **No vendor/stash/waypoint changes**
- **No schema/database changes**: no Prisma migration required
- **No persistent state regressions**: existing leave→persist→rejoin flow remains unchanged
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

### Task 301 — Keyboard Shortcut Focus Guard

Prevented gameplay keyboard shortcuts from firing while focus is inside editable UI elements (input fields, textareas, selects, contenteditable), closing a lingering Pillar 1 gap.

- **Audit** — identified all gameplay keyboard shortcut locations:
  - `worldSessionDodgeInput.ts` — Spacebar (dodge) — already guarded via `shouldIgnoreWorldSessionCombatHotkey()` ✓
  - `worldSessionHealingFlaskInput.ts` — Q key (healing flask) — already guarded via `shouldIgnoreWorldSessionCombatHotkey()` ✓
  - `worldSessionAreaView.ts` — +/- and Numpad +/- (zoom) — NOT guarded ✗
- **Fix** (`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`):
  - Added `import { shouldIgnoreWorldSessionCombatHotkey } from "./worldSessionCombatHotkeyFocus";`
  - Wrapped both `zoomIn` and `zoomOut` Phaser key `"down"` handlers with `if (shouldIgnoreWorldSessionCombatHotkey()) return;`
- **Existing guard** (`apps/client/src/game/scenes/worldSession/worldSessionCombatHotkeyFocus.ts`):
  - Reusable helper `shouldIgnoreWorldSessionCombatHotkey()` returns `true` when `document.activeElement` is an `HTMLInputElement`, `HTMLTextAreaElement`, `HTMLSelectElement`, or has `isContentEditable === true`
  - Already used by dodge (Space) and healing flask (Q) modules
- **No UI redesign, no Vue migration, no settings menu, no keybinding remap, no chat system, no schema/database changes.**
- **Mouse movement/combat/loot/interactable behavior unchanged.**
- **Area banner and town refill behavior unchanged.**
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass.

### Task 300 — Surface Full Inventory Pickup Rejection

Ensured that when loot pickup fails because the inventory has no valid space, the player sees a clear localized message instead of silent failure or unreliable behavior.

- **Server audit** — wired through the existing `RequestPickupWorldLootRejectedServerMessage` with `reason: "inventory_full"`:
  - `pickupWorldLootDispatcher.ts` already maps `PickupWorldLootFailureReason` refusal to `"inventory_full"` reason code
  - `pickupWorldLootInventory.ts` already returns `{ ok: false, reason: "inventory_full" }` when no grid slot is available
- **Fix:** `deferredActionExecution.ts` — removed redundant `interact_response` send that was hardcoding "Inventory full." / "Pickup unavailable." as English strings after the deferred pickup path already sent the proper `request_pickup_world_loot_rejected` message. The client now handles the rejection exclusively through the typed `onRejected` callback (already wired with localized keys).
- **Client handling** — `WorldSessionScene.ts` `onRejected` callback already routes `"inventory_full"` to `t("world_area.inventory_full")` → "Inventory full." — no client changes needed.
- **Localization** — `world_area.inventory_full` key already present in English locale.
- **No inventory redesign, no auto-sort, no bag expansion, no stash, no item stacking rewrite, no loot table changes.**
- **No schema/database changes** — no Prisma migration required.
- **Server remains authoritative**: the server decides the pickup outcome; the client only shows the rejection message.
- **Validation**: `pnpm validate:0.1` and `pnpm validate:0.2` both pass.

---

## Midpoint Status

Core Build 0.2 is **roughly 70–75% complete** after Tasks 284–301. Five work blocks have shipped:

1. **Interaction intent / move-then-act (285–288):** Movement intent validation, server-authoritative position stepping, deferred action queue (attack/pickup/interact after move), dodge intent, approach-target resolution.
2. **Content validation / Nightmarket cleanup / first content slice (289–293):** Content registry validation hardened, hardcoded Nightmarket branching removed, zone-fallback replaced with content-registry resolver, first data-driven content slice (ambient rats + tarnished_coin + loot table entries).
3. **World readability / localized prop labels (294–296):** Boundary markers, safe-area ring, `labelKey` support with 31 English locale keys, client and server label resolution through the localization layer.
4. **Full-inventory pickup rejection (300):** Server pickup rejection audit ensuring `inventory_full` reason is surfaced through the typed protocol message; fixed double-notification bug in `deferredActionExecution.ts` that was sending both the proper rejected message and a redundant hardcoded `interact_response`.
5. **Keyboard shortcut focus guard (301):** Guarded zoom +/-/numpad keys with the existing `shouldIgnoreWorldSessionCombatHotkey()` helper. All gameplay hotkeys (Space/dodge, Q/flask, +/-/zoom) now skip when focus is inside an editable UI element.

Pillar 1 (UI/Input) now has one item shipped (keyboard focus). Pillar 2 (Reconnect) remains unstarted. Pillar 4 has one item completed (inventory rejection). Pillars 5 and 6 are partially covered.

**Out of scope for 0.2:** vendors, stash, waypoints, safe-zone combat enforcement, Vue/app-shell migration, large character customization, large new zone, class/skill overhaul.

**Proposed next tasks** (not implemented yet): content registry CI tests, camera smoothness pass, full reconnect re-test.

---

## Validation Status

- `pnpm validate:0.1` — passing (same known warnings as 0.1 RC)
- `pnpm validate:0.2` — passing (identical to 0.1 at baseline)

### Task 303 — Add Physical Town Rest Area Refill Trigger

Added a visible, server-authoritative town rest/replenish area inside the Nightmarket service cluster. The player can now step into a marked area to restore HP and healing flask charges.

#### Content/Data Changes

- **New content type** (`packages/content/src/data/types.ts`):
  - `ZoneContentRestAreaBounds` interface added: `{ minX, maxX, minY, maxY }` rectangular bound
  - `restAreaBounds?: ZoneContentRestAreaBounds` added to `ZoneContentDefinition` — optional per-zone
  - `"rest_area_marker"` added to `WorldPropKind` for visual markers

- **Zone definition** (`packages/content/src/data/zones.ts`):
  - Nightmarket zone now has `restAreaBounds: { minX: 40, maxX: 540, minY: 80, maxY: 480 }` covering the service cluster (spawn area, notice board, vendor, stash keeper, trainer, waypoint, crates)

- **World props** (`packages/content/src/data/worldProps.ts`):
  - 5 `rest_area_marker` props added: 4 corner markers + 1 center label marker, all with `labelKey: "world_prop.rest_area.label"`
  - Existing `safe_area_marker` markers unchanged

- **Localization** (`packages/localization/src/locales/en.ts`):
  - `world_prop.rest_area.label`: "Rest Area"

- **Content validation** (`packages/content/src/ContentValidation.ts`):
  - `"rest_area_marker"` added to `VALID_WORLD_PROP_KINDS`

#### Server Changes

- **New server helper** (`apps/server/src/realtime/rooms/townRestAreaTrigger.ts`):
  - `applyTownRestAreaRefill(zoneId, player)`: Resolves `restAreaBounds` from zone content, checks if player (x,y) is inside the bounds and alive, calls `applyTownRestRefill()` only when conditions are met
  - `applyTownRestAreaRefillForAll(zoneId, playerPresence)`: Iterates all players in the room, runs the check, returns a `Map<sessionId, boolean>` of players whose values changed
  - Both functions are side-effect-free beyond mutating the supplied `PlayerPresence`; they do not persist or broadcast
  - Built-in spam prevention: `applyTownRestRefill` returns `changed: false` when already full, so notifications only fire when values actually change

- **TownRoom integration** (`apps/server/src/realtime/rooms/TownRoom.ts`):
  - Imports `applyTownRestAreaRefillForAll` from the new helper
  - Wired into the room simulation tick (50ms interval) after movement, enemy aggro, and respawn logic
  - When a player's values change, sends `town_rest_refill` message to that client for localized notification
  - Existing on-join `applyTownRestRefill` remains intact and unchanged

- **No schema/database changes**: no Prisma migration required
- **No mana/resource system**: no fake mana behavior introduced
- **No safe-zone combat enforcement**: rest area is visual + refill only
- **No rest shrine UI panel, no vendor/stash/waypoint changes**
- **Existing town on-join refill remains functional**
- **Movement, combat, loot pickup, interactables, area banner, inventory, death/corpse recovery unchanged**

---

### Task 304 — Add Rest Area Visual Feedback Polish

Made the physical town rest area easier to understand when the player enters it by adding lightweight visual feedback without introducing a new UI panel or resource system.

#### Client Changes

- **Rest area marker rendering** (`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`):
  - Added `rest_area_marker` case to `buildPropContainer()` switch — renders as a teal double-ring with inner dot (distinct from the green `safe_area_marker`)
  - Label color for `rest_area_marker` uses teal (`#7ad8c0`) to distinguish from the green safe area markers

- **Client-side rest area detection** (`apps/client/src/game/scenes/worldSession/townRestAreaDetection.ts`):
  - New helper module that reads `restAreaBounds` from the zone content definition via `contentRegistry.zones`
  - `checkPlayerInRestArea(zoneId, px, py)` checks if a point is inside the rest area bounds
  - Purely visual client-side check; does not duplicate server-side refill logic

- **Rest area enter/exit tracking** (`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`):
  - Added `wasInRestArea` tracking variable and `checkPlayerInRestArea` import
  - On each `refreshFromRoomState()`, after position update, checks if the player is inside the rest area
  - On entering: fires `onPickupFeedback` with localized "Rest Area — Replenishing" notice (one-time)
  - On exiting: fires `onPickupFeedback` with localized "Left Rest Area" notice (one-time)
  - Shows a persistent small teal "Rest Area" text label above the player while inside (no `pointer-events` concerns since it's a Phaser text object in the world container)
  - No message spam: only fires enter/exit callbacks on state transitions, not every tick

#### Localization

- `world_session.rest_area_entered`: "Rest Area — Replenishing"
- `world_session.rest_area_exited`: "Left Rest Area"
- Both added to `REQUIRED_LOCALIZATION_KEYS` in `LocaleTypes.ts`

#### What Did NOT Change

- Server-authoritative refill logic unchanged (existing `townRestAreaTrigger.ts` + `TownRoom.ts` simulation tick)
- Existing `town_rest_refill` server message and its client handler unchanged (fires only when HP/flask values actually change)
- No schema/database changes
- No mana/resource system
- No safe-zone combat enforcement
- No rest UI panel
- Movement, combat, loot pickup, interactables, area banner, inventory, and keyboard shortcuts unchanged
- Validation: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

### Task 305 — Core 0.2 Fast Polish Batch — Rest Bounds Validation + Area Banner Robustness + Release Notes

This task bundles a few small, safe polish/hardening items around the already implemented area banner and town rest-area systems.

#### Harden Rest Area Content Validation

- **Content validation** (`packages/content/src/ContentValidation.ts`):
  - Validated `zone.restAreaBounds` when present, ensuring all values are finite numbers, `minX < maxX`, `minY < maxY`, and that rest area bounds are inside or equal to the zone bounds.
  - Produces clear validation errors for invalid rest area bounds.

#### Improve Area Banner Robustness

- **Area banner view** (`apps/client/src/game/scenes/worldSession/worldSessionAreaBannerView.ts`):
  - `resolveZoneDisplayName` now handles `zoneId` missing, empty, or unknown by falling back to title-casing the raw `zoneId` or a generic `"Unknown Area"` string.
  - Added `clearTimers()` in the `destroy` method to safely clear animation timers if the scene is torn down before animations finishes.
  - `pointer-events: none` on the root element remains to ensure input pass-through.
- **Scene integration** (`apps/client/src/game/scenes/WorldSessionScene.ts`):
  - `showAreaBanner()` now explicitly checks if `zoneId` is a valid non-empty string before attempting to create and show the banner.
  - The `areaBanner` instance is now destroyed within `handleSceneTeardown` which is called on `SHUTDOWN` and `DESTROY` scene events.

#### Improve Rest Area Visual Behavior

- **Client-side rest area detection** (`apps/client/src/game/scenes/worldSession/townRestAreaDetection.ts`):
  - `resolveZoneRestAreaBounds()` now explicitly checks for a valid `zoneId` and `zone.restAreaBounds` to safely return `null` if they are missing or unknown.
- **Rest area enter/exit tracking** (`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`):
  - The floating "Rest Area" label is now explicitly set to an empty string (`""`) in the `destroy` method, ensuring it's hidden on scene teardown or zone/session exit.
  - The enter/exit spam prevention logic (only firing on state transitions) remains in place, ensuring non-spammy behavior during normal movement.

#### Documentation Updates

- **`docs/CORE_BUILD_0_2_CHECKLIST.md`**: Updated task 305 status.
- **`docs/CORE_BUILD_0_2_RELEASE_NOTES.md`**: This section added.
- **`docs/TECH_DEBT.md`**: No new tech debt was introduced by this task, and no existing tech debt was resolved related to rest/banner systems. Therefore, `TECH_DEBT.md` was not updated.

---

### Task 306 — Combat Feel Tuning Batch

Small, conservative tuning batch to improve moment-to-moment combat feel without adding new abilities, systems or formula changes.

#### Player Attack Cadence

- **Stat formula** (`apps/server/src/character/CharacterStatsService.ts`):
  - Reduced base from `1100` to `1000` in `attackCooldownMs = max(500, 1000 - speed * 25)`
  - At starting stats (speed 3): **~925 ms** (was ~1025 ms) — ~10% faster attack cadence
  - 500 ms hard floor unchanged; high-speed builds unaffected
  - Doc comment updated to reflect new formula and tuning rationale

- **Default fallback** (`apps/server/src/realtime/rooms/attackCooldown.ts`):
  - `DEFAULT_ATTACK_COOLDOWN_MS` reduced from **700 ms to 600 ms**
  - Affects only fallback when no persisted stat is available; not the normal path

#### Enemy Attack Pressure

- **Content data** (`packages/content/src/data/enemies.ts`):
  - Trashboar Runt: **1180 → 1050 ms** (~11% faster)
  - Trashboar Brute: **980 → 850 ms** (~13% faster)
  - Trashboar Skitter: **1100 → 980 ms** (~11% faster)
  - All values remain conservative; no enemy dies in fewer hits

- **Enemy attack windup** (`apps/server/src/realtime/rooms/TownRoom.ts`, `CombatRoom.ts`):
  - `ENEMY_ATTACK_WINDUP_MS` reduced from **350 ms to 300 ms** in both rooms
  - Telegraph-to-damage gap is now tighter, making enemy attacks feel more responsive

#### What Did NOT Change

- Combat damage formula unchanged
- Enemy AI architecture unchanged (no new states, no pathfinding, no aggro logic changes)
- Server remains authoritative for all combat outcomes
- No new abilities, status effects, skill tree, charged attacks or mana system
- No schema/database changes
- No animation system rewrite
- No client-side combat authority introduced
- Validation: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

---

### Task 307 — Fix WorldSession Lag Over Time

Diagnosed and fixed the root cause of progressive FPS degradation during extended WorldSession play.

#### Root Causes Found

1. **Event listener churn (~60fps):** `inputZone.removeAllListeners()` + re-registration of POINTER_DOWN/MOVE/UP handlers was inside `refreshFromRoomState()`, which was called from the Phaser UPDATE loop at ~60fps. Every frame, all three input listeners were torn down and re-registered, causing massive listener churn.

2. **Per-frame Phaser object destroy/recreate:** `staticPropsView.refresh()` and `interactablesView.refresh()` destroyed ALL child Phaser objects (containers, graphics, text) and recreated them from scratch on every frame, causing extreme garbage collection pressure.

3. **Unnecessary graphics redraw:** `drawViewportFrame()` and `drawBounds()` cleared and redrawd grid/boundary graphics every frame despite never changing.

#### Fix Applied

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`:**
  - Moved input zone handler registration OUT of `refreshFromRoomState()` to run ONCE during setup. Handlers now read current projection/offset from module-scope variables (`currentWorldProjection`, `currentWorldOffset`) that are updated by `refreshFromRoomState` on state changes.
  - Added `roomStateDirty` flag. Background graphics, static props, and interactables are only destroyed/recreated when the flag is true (set by Colyseus state changes, zoom changes, projection mode changes, and pending pickup target updates).
  - Removed `refreshFromRoomState(room)` call from the per-frame UPDATE loop (`handleSceneUpdate`). The expensive full refresh now only runs when `room.onStateChange` fires in WorldSessionScene. The per-frame loop only handles lightweight continuous actions (held movement throttle, pending attack/loot/interact range checks).
  - Added `inputZone.removeAllListeners()` in the `destroy()` method for proper cleanup.

#### What Changed

- No gameplay behavior changed
- No server-side changes
- No schema changes
- No new UI panels or features

#### Impact

- Input listeners registered once per scene lifetime instead of ~60 times per second
- Static props and interactables Phaser objects destroyed/recreated only on state changes instead of every frame
- Background graphics redrawn only on state changes
- Significantly reduced garbage collection pressure and CPU overhead during extended play

- Validation: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

---

### Task 308 — Guard WorldSession Refresh/Update Boundaries After Lag Fix

Added structured guardrail comments to `worldSessionAreaView.ts` to make the expensive-refresh vs. lightweight-update boundary explicit and prevent future regression.

#### Section Comments Inside `refreshFromRoomState`

- Added `[A]` / `[B]` / `[C]` / `[D]` section labels to `refreshFromRoomState()` documenting the internal cost structure:
  - `[A]` Projection + container offset — lightweight math, always runs
  - `[B]` `roomStateDirty` section — EXPENSIVE: redraws graphics, destroys/recreates static props and interactables
  - `[C]` Entity processing — runs on every call but only touches individual entities (not a full rebuild)
  - `[D]` Player position + rest area — lightweight: moves existing objects, updates text labels
- Added a top-level doc comment listing all call sites and explicitly stating `refreshFromRoomState` must NEVER be called from the per-frame UPDATE loop

#### `roomStateDirty` Flag Guardrails

- Expanded the `roomStateDirty` doc comment to list every setter (Colyseus state change, zoom, projection mode, pending pickup target) and explicitly state that the per-frame UPDATE loop does NOT read this flag

#### Input Handler Registration Guard

- Added a `ONE-TIME setup` comment block above the `inputZone.on()` handlers with an explicit `GUARD` warning that these must NOT be registered inside `refreshFromRoomState()` or the UPDATE loop

#### Per-Frame UPDATE Handler Guardrails

- Added a comprehensive comment block above `handleSceneUpdate()` listing:
  - Allowed operations: held movement throttle, pending attack/loot/interact range checks
  - Forbidden operations: `refreshFromRoomState()`, `staticPropsView.refresh()`, `interactablesView.refresh()`, `drawViewportFrame()`, `drawBounds()`, `inputZone.on()` calls
  - Explicit statement that the expensive refresh path lives exclusively in `refreshFromRoomState()` triggered by Colyseus state changes

#### What Did NOT Change

- No runtime behavior changed — these are comment-only additions
- No gameplay, combat, movement, loot, inventory, equipment, or UI changes
- No schema/database changes
- No new features or tests
- Validation: `pnpm validate:0.1` and `pnpm validate:0.2` both pass

---

## Known Deferred Items

*(To be completed at candidate time.)*
