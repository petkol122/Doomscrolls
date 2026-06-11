# Technical Debt

_Last updated: Core 0.2_

## Hardcoded Content/Gameplay Literals (not yet moved to content/config)

These are literals that should eventually be data-driven rather than hardcoded in source code. They are documented here for future refactoring.

### Server

- **`apps/server/src/realtime/rooms/TownRoom.ts`** — _(resolved in Task 291)_ replaced hardcoded `"nightmarket"` fallback with `resolveTownZoneId()` content-resolver helper
- **`apps/server/src/realtime/rooms/initializeTownInteractables.ts`** — _(resolved in Task 290)_ now uses data-driven zone-based world prop filtering instead of the hardcoded `zoneId === "nightmarket"` branch
- Various combat/room files may reference specific enemy IDs, zone IDs, or spawn point IDs as string literals — these should be refactored to use content registry lookups

### Client

- **`apps/client/src/net/RealtimeClient.ts`** — _(resolved in Task 292)_ replaced hardcoded `"nightmarket"` fallback with neutral `"unknown"` fallback in `formatTownRoomState()`
- World prop `label` fields in `worldProps.ts` are hardcoded English strings (e.g. `"Nightmarket Services"`, `"Notice Board"`, `"Lamp"`). These should be localization keys. — _(resolved in Task 296)_ all player-facing world prop labels now have `labelKey` references to English locale keys; `label` kept as fallback only.
- `"trashboar_runt"` / `"trashboar_brute"` / `"trashboar_skitter"` spriteKey values in `enemies.ts` currently all point to the same placeholder key — this is acceptable for placeholder phase but must become content-driven per enemy.
- Client room/combat scene code may reference specific zone IDs as string literals.

## Known Shortcuts

- **Vendor stock entries** (vendorStocks.ts) have no vendor-ref validation beyond the new content validation — no actual buy/sell behavior exists.
- **Town service definitions** (townServices.ts) are placeholders with `unavailableMessageKey` — no real stash, trainer, or waypoint functionality.
- **Objective `zoneId`** is optional on the type but all current objectives set it — validation checks it only when present.
- **Content registry `spawnZones`** collection is not wrapped in a `ContentCollection` (it uses raw `readonly SpawnZoneDefinition[]`) — the validation accesses it directly via `registry.spawnZones`.
- **Town rest refill** (`applyTownRestRefill` in `apps/server/src/realtime/rooms/townRestRefill.ts`) — only restores HP and healing flask charges. Future class-specific resources (mana, rage, etc.) should be restored here once those systems exist, but no resource system exists yet in Core 0.1/0.2.
- **Town rest refill trigger scope** — _(Task 303, partially resolved)_ A physical rest/replenish area now exists inside the Nightmarket service cluster (bounds defined via `restAreaBounds` in `zones.ts`). The server triggers `applyTownRestRefill` on each tick for players standing inside the area, with spam-free notification (only when values change). Future extensions could add a rest shrine interactable, a UI panel, or safe-zone combat suppression, but no such features exist yet.
