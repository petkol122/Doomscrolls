# Technical Debt

_Last updated: Core 0.2_

## Hardcoded Content/Gameplay Literals (not yet moved to content/config)

These are literals that should eventually be data-driven rather than hardcoded in source code. They are documented here for future refactoring.

### Server

- **`apps/server/src/realtime/rooms/TownRoom.ts`** — _(resolved in Task 291)_ replaced hardcoded `"nightmarket"` fallback with `resolveTownZoneId()` content-resolver helper
- **`apps/server/src/realtime/rooms/initializeTownInteractables.ts`** — _(resolved in Task 290)_ now uses data-driven zone-based world prop filtering instead of the hardcoded `zoneId === "nightmarket"` branch
- Various combat/room files may reference specific enemy IDs, zone IDs, or spawn point IDs as string literals — these should be refactored to use content registry lookups

### Client

- **`apps/client/src/net/RealtimeClient.ts`** — `formatTownRoomState()` has a hardcoded `"nightmarket"` fallback for `zoneId` display fallback; this is cosmetic/display-only and should be resolved from room state once `zoneId` is always present (Task 291 resolved the server side)
- World prop `label` fields in `worldProps.ts` are hardcoded English strings (e.g. `"Nightmarket Services"`, `"Notice Board"`, `"Lamp"`). These should be localization keys.
- `"trashboar_runt"` / `"trashboar_brute"` / `"trashboar_skitter"` spriteKey values in `enemies.ts` currently all point to the same placeholder key — this is acceptable for placeholder phase but must become content-driven per enemy.
- Client room/combat scene code may reference specific zone IDs as string literals.

## Known Shortcuts

- **Vendor stock entries** (vendorStocks.ts) have no vendor-ref validation beyond the new content validation — no actual buy/sell behavior exists.
- **Town service definitions** (townServices.ts) are placeholders with `unavailableMessageKey` — no real stash, trainer, or waypoint functionality.
- **Objective `zoneId`** is optional on the type but all current objectives set it — validation checks it only when present.
- **Content registry `spawnZones`** collection is not wrapped in a `ContentCollection` (it uses raw `readonly SpawnZoneDefinition[]`) — the validation accesses it directly via `registry.spawnZones`.