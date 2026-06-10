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

---

## Validation Status

- `pnpm validate:0.1` — passing (same known warnings as 0.1 RC)
- `pnpm validate:0.2` — passing (identical to 0.1 at baseline)

---

## Known Deferred Items

*(To be completed at candidate time.)*
