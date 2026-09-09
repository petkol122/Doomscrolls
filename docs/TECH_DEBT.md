# Technical Debt

_Last updated: Core 0.33 (post "real-world map foundation, global chat persistence, building collision")_

## Hardcoded Content/Gameplay Literals (not yet moved to content/config)

These are literals that should eventually be data-driven rather than hardcoded in source code. They are documented here for future refactoring.

### Server

- **`apps/server/src/realtime/rooms/TownRoom.ts`** — _(resolved in Task 291)_ replaced hardcoded `"nightmarket"` fallback with `resolveTownZoneId()` content-resolver helper
- **`apps/server/src/realtime/rooms/initializeTownInteractables.ts`** — _(resolved in Task 290)_ now uses data-driven zone-based world prop filtering instead of the hardcoded `zoneId === "nightmarket"` branch
- Various combat/room files may reference specific enemy IDs, zone IDs, or spawn point IDs as string literals — these should be refactored to use content registry lookups

### Client

- **`apps/client/src/net/RealtimeClient.ts`** — _(resolved in Task 292)_ replaced hardcoded `"nightmarket"` fallback with neutral `"unknown"` fallback in `formatTownRoomState()`
- World prop `label` fields in `worldProps.ts` are hardcoded English strings (e.g. `"Nightmarket Services"`, `"Notice Board"`, `"Lamp"`). These should be localization keys. — _(resolved in Task 296)_ all player-facing world prop labels now have `labelKey` references to English locale keys; `label` kept as fallback only.
- Client room/combat scene code may reference specific zone IDs as string literals.

## Placeholder Art (pack-wide)

- **All content packs currently ship placeholder art keys**: every item in `items.ts` (~40+), every enemy in `enemies.ts` (12), and every zone in `zones.ts` (5) use `*_placeholder` icon/sprite/mapKey values (e.g. `trashboar_runt`/`trashboar_brute`/`trashboar_skitter` in `enemies.ts` all point to the same placeholder sprite key). This is acceptable for the current placeholder-art phase but every one of these needs real art + content-driven keys before ship.

## Known Shortcuts

- **Town service definitions** (`packages/content/src/data/townServices.ts`) — currently an **empty array**; town services (stash, trainer, waypoint, etc.) were deliberately deferred pending the Nightmarket removal / Namesti Republiky foundation work and do not exist yet in any form, not even as placeholders.
- **Objective `zoneId`** is optional on the type but all current objectives set it — validation checks it only when present.
- **Content registry `spawnZones`** collection is not wrapped in a `ContentCollection` (it uses raw `readonly SpawnZoneDefinition[]`) — the validation accesses it directly via `registry.spawnZones`, unlike every other collection (`worldProps`, `vendorStocks`, `townServices`, etc.) which use `createCollection`.
- **Town rest refill** (`applyTownRestRefill` in `apps/server/src/realtime/rooms/townRestRefill.ts`) — only restores HP and healing flask charges. Future class-specific resources (mana, rage, etc.) should be restored here once those systems exist, but no resource system exists yet anywhere in `apps/server/src`.
- **Town rest refill trigger scope** — _(Task 303, partially resolved)_ A physical rest/replenish area now exists inside the Nightmarket service cluster (bounds defined via `restAreaBounds` in `zones.ts`). The server triggers `applyTownRestRefill` on each tick for players standing inside the area, with spam-free notification (only when values change). Future extensions could add a rest shrine interactable, a UI panel, or safe-zone combat suppression, but no such features exist yet.
- **Building-avoidance pathfinding obstacle cap** (`apps/server/src/realtime/rooms/buildingAvoidancePathfinding.ts:39`) — `MAX_OBSTACLES_CONSIDERED` is hardcoded to 12; in dense zones this can cause the pathfinder to skip the geometrically optimal route around buildings. Acknowledged in an inline comment but not load-tested against denser building layouts.
- **Global chat has no message retention/pruning** (`apps/server/src/persistence/repositories/ChatRepository.ts`) — messages are only ever inserted (`create`), never purged. `globalChatHandler.ts` limits the read window to the last 50 messages, but the underlying `chatMessage` table grows unbounded over time.
- **Duplicated inventory-slot-placement logic** (`apps/server/src/realtime/rooms/vendorBuyItem.ts:149-236`) — `findFirstAvailableInventorySlot`/`canPlaceItemAt` are duplicated from `pickupWorldLootInventory.ts` to keep the room file thin, per an inline comment; a shared helper should be extracted.

## Resolved (kept for history)

- **Vendor buy/sell** — previously "no actual buy/sell behavior exists"; now fully implemented server-authoritatively in `apps/server/src/realtime/rooms/vendorBuyItem.ts` and `vendorSellItem.ts` (currency, stock, inventory placement, transactions).
