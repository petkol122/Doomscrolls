# docs/CORE_BUILD_0_3_RELEASE_NOTES.md — Core Build 0.3 Release Notes

## Task 331 — Travel Foundation: Town to Combat Area Routing

**Summary:**

Implemented the first real server-authoritative town → combat → town loop inside the existing Nightmarket zone. Players can now use a Blackwire Gate near the service hub to jump to the hostile Blackwire Sewer Edge pocket and use a return marker there to jump back to the Nightmarket services area.

**Changes:**

- **`packages/content/src/data/spawnPoints.ts`** and **`packages/content/src/data/types.ts`**: Added two real same-zone travel destinations, one for the combat-edge arrival point and one for the return point to the service hub, and extended the spawn-point content id union accordingly.

- **`packages/content/src/data/worldProps.ts`**: Added a service-hub route interactable (`nightmarket_blackwire_gate_01`) and a combat-edge return interactable (`nightmarket_blackwire_return_01`) using the existing Nightmarket zone.

- **`apps/server/src/realtime/rooms/initializeTownInteractables.ts`**: Extended the data-driven interactable initialization to include `combat_edge` props in the synced interactable set.

- **`apps/server/src/realtime/rooms/interactValidation.ts`**: Added localized safe interaction prompt text for the new Blackwire gate and return marker.

- **`apps/server/src/realtime/rooms/waypointService.ts`**: Added a focused same-zone route-travel resolver with server-owned validation for known route interactables, known destination spawn points, and valid in-bounds destination coordinates, plus localized rejection mapping.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added accepted/rejected room-message contracts for route travel feedback so the client consumes explicit server results.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Added the new route-travel interaction flow. On success, the server immediately updates synced player position, clears pending movement/action state, persists the new character location through `CharacterService.updateCharacterLocation()`, and sends localized travel feedback.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Added accepted/rejected route-travel feedback handling using the existing world-session notice flow, without any fake client-side transition or local-only position change.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added the required localization keys for the new route prompts, success/rejection text, new spawn labels, and interactable labels.

**Verification:**

- Focused validation is still pending.

**Known limitations:**

- Travel currently stays inside the existing Nightmarket zone instead of switching to `CombatRoom`.
- No dungeon system, world map, portal system, minimap, or quest-driven travel was added.
- The loop intentionally reuses the current Nightmarket hostile pocket rather than introducing a separate real combat-room handoff.

## Task 330 — Waypoint Foundation: Activate and Use Basic Town Waypoint

**Summary:**

Implemented the first real waypoint flow in the Nightmarket. Interacting with the Nightmarket waypoint now activates it for the current character, opens a localized waypoint panel, lists the currently available destination, and allows a basic server-authoritative travel action that updates both live room position and persisted character location.

**Changes:**

- **`packages/shared/src/room/WaypointTypes.ts`**: Added shared waypoint destination and rejection types for the new waypoint foundation.

- **`packages/shared/src/protocol/ClientMessages.ts`** and **`packages/shared/src/protocol/ServerMessages.ts`**: Added `request_waypoint_travel`, `waypoint_opened`, `request_waypoint_travel_accepted`, and `request_waypoint_travel_rejected` message contracts so the client sends only travel intent while the server owns activation, validation, and the resulting position update.

- **`apps/server/prisma/schema.prisma`** and **`apps/server/prisma/migrations/20260611150000_add_character_waypoint_activations/migration.sql`**: Added persistent character-scoped waypoint activation storage through the new `CharacterWaypointActivation` model.

- **`apps/server/src/persistence/repositories/CharacterRepository.ts`**: Added repository helpers to upsert a waypoint activation and list a character’s activated waypoints.

- **`apps/server/src/realtime/rooms/waypointService.ts`**: Added a focused waypoint helper module that activates the Nightmarket waypoint, builds the server-owned panel payload, validates the conservative travel destination, and maps typed rejection reasons to localized feedback.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Replaced the old waypoint placeholder interaction with a real room-authoritative flow. Interacting with `nightmarket_waypoint_01` now activates and opens the waypoint panel. The new `request_waypoint_travel` handler validates the destination, updates synced player presence coordinates server-side, clears movement targets/pending actions, and persists the new character location immediately.

- **`apps/client/src/game/scenes/worldSession/waypointInteractionPanel.ts`**: Added a dedicated localized waypoint panel instead of reusing the generic placeholder town-service panel. The panel shows a title, subtitle, available destinations, travel buttons, and an empty state.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Added handling for `waypoint_opened`, `request_waypoint_travel_accepted`, and `request_waypoint_travel_rejected`. The client now opens the real panel on server response, sends travel intent back to the room, and displays localized success/failure feedback.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added the required localized waypoint panel text, status text, destination label, and rejection messages.

**Verification:**

- `pnpm --filter @doomscrolls/server prisma:generate` — passed after releasing the locked Prisma engine file
- Focused typecheck/runtime verification still pending

**Known limitations:**

- Only one conservative destination is exposed for now: Nightmarket Arrival
- No world map, minimap, travel cost, cooldown, portal system, or combat-room routing
- Waypoint unlocks are currently character-scoped, not account-scoped

## Task 329 — Stash Foundation: Server-Authoritative Inventory ↔ Stash Transfer

**Summary:**

Implemented the first real stash transfer flow in town. The Nightmarket stash keeper now supports storing inventory items into stash and taking stash items back into inventory through server-authoritative Colyseus room messages. The server validates ownership, item state, stash availability, and placement rules before updating persistence atomically.

**Changes:**

- **`packages/shared/src/room/StashTypes.ts`**: Added typed rejection reasons for both transfer directions so the client can display safe localized failure feedback without inventing state.

- **`packages/shared/src/protocol/ClientMessages.ts`** and **`packages/shared/src/protocol/ServerMessages.ts`**: Added `request_store_inventory_item_in_stash` and `request_take_stash_item_to_inventory` message contracts plus accepted/rejected response types. Accepted responses include the refreshed authoritative stash item list.

- **`apps/server/src/realtime/rooms/stashTransferItem.ts`**: Added the server-authoritative stash transfer service. It validates ownership and item location, resolves stash/inventory placement using grid collision rules, and updates the item location atomically in a Prisma transaction.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Registered async handlers for both stash transfer directions and reused the existing stash keeper room-service flow. Transfers remain room/server authoritative; the client only sends intent.

- **`apps/client/src/game/scenes/worldSession/stashInteractionPanel.ts`**: Upgraded the stash panel from list-only to a simple two-section view with Inventory and Stash entries plus localized Store / Take buttons.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Wired Store / Take button clicks to the new room messages, handled accepted/rejected responses, refreshed stash list state from authoritative room responses, and refreshed inventory/account state through the existing `/me` path.

- **`packages/localization/src/locales/en.ts`** and **`packages/localization/src/LocaleTypes.ts`**: Added localized success messages, action labels, section labels, and rejection feedback for stash full / inventory full / item-state failures.

**Verification:**

- Focused verification is still pending.

**Known limitations:**

- No drag/drop stash UI
- No stash sorting/filtering or tabs/pages UI beyond existing minimal placement fields
- No account-wide stash
- No stack splitting/merging changes

## Task 326 — WorldSession Camera/Projection Layer Unification Fix

**Summary:**

Fixed the blocking WorldSession camera/projection regression introduced by the recent projection work. Camera follow and zoom now update the whole rendered world as one coherent scene, so enemies no longer appear to drift independently while static world props stay visually stale.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Promoted the active camera/projection state into one live `currentProjectionState` object shared by pointer conversion and render refresh logic. Added lightweight reprojection updates that run on every refresh so camera movement and zoom reposition the whole world even when no expensive rebuild is needed.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added guardrail comments clarifying the difference between rebuild paths and projection-only position updates, including why camera movement must still update rendered positions when authoritative room state is unchanged.

- **`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`**: Added `updateProjection()` so static props, boundary markers, safe-area markers, rest-area markers, ambient props, and area labels can move with the live projection state without destroy/recreate loops.

- **`apps/client/src/game/scenes/worldSession/worldSessionInteractablesView.ts`**: Added `updateProjection()` plus reusable interactable drawing helpers so vendors, stash keepers, waypoint/trainer placeholders, loot containers, and their hit areas stay aligned during camera follow and zoom changes without re-registering listeners or rebuilding objects every frame.

**Verification:**

- Focused client typecheck still pending after the projection refactor.

**Known limitations:**

- This fix does not add new gameplay systems, stash transfer, waypoint travel, quest flow, vendor redesign, or HUD redesign.

## Task 327 — WorldSession Enemy Visibility, Culling, and Projection Sanity Fix

**Summary:**

Fixed the remaining WorldSession enemy visibility/projection mismatch so offscreen enemies no longer appear as distant waypoint-style markers and visible enemies stay aligned with hover/click targeting across zoom and camera movement. The server still simulates all enemies normally; this change only controls which server-known enemies the client currently renders and allows as visible targets.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added a client visibility guardrail that distinguishes between server-known enemies, client-rendered visible enemies, and client-clickable visible enemies. The render/input path now keeps a shared live enemy projection snapshot map for current visible targets only.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated enemy projection flow so render visibility, hover hit-testing, click hit-testing, skill-target distance UI, telegraph lookup, and floating damage anchor lookup all read from the same current projection result instead of mixing stale cached positions with newer camera/zoom state.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added viewport culling with a small padding margin (`ENTITY_VIEWPORT_PADDING_PX = 36`) so enemies near the edge do not pop aggressively, while enemies outside the current visible area no longer render labels/targets or behave like offscreen waypoints.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Preserved performance safety by keeping enemy placeholder instances alive and hiding offscreen ones instead of destroying/recreating them on every camera or zoom update. Existing one-time listener registration and dirty-gated rebuild protections remain intact.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added cleanup for stale hovered/selected enemy state when an enemy leaves the visible projected set, preventing offscreen hover/click resolution and stale targeting UI after movement or zoom changes.

**Verification:**

- Focused client typecheck is still pending after the visibility/projection pass.

**Known limitations:**

- This task does not add fog-of-war, stealth/detection, minimap indicators, AI changes, spawn changes, stash transfer, waypoint travel, quest flow, or physical spacing changes.

## Task 328 — Nightmarket Physical Scale and Content Spacing Pass

**Summary:**

Made the Nightmarket feel physically larger through content-data layout changes instead of camera tricks or click hacks. The main town services now occupy a wider readable hub footprint, low-priority clutter is less likely to crowd the important click targets, and the nearby enemy pockets are pushed farther from town and farther apart from one another.

**Changes:**

- **`packages/content/src/data/worldProps.ts`**: Repositioned the Nightmarket service-hub world props without changing any IDs. The notice board, Suspicious Vendor, Stash Keeper, Trainer, and Waypoint now sit farther apart inside the town hub so they are easier to distinguish and click individually.

- **`packages/content/src/data/worldProps.ts`**: Moved supporting props and low-priority clutter away from the main click lane. Nearby crates, junk, and ambient creatures were redistributed so the core service objects read more clearly while the hub still feels populated.

- **`packages/content/src/data/worldProps.ts`**: Shifted the service-hub labels, safe-area markers, rest-area markers, sewer-approach path markers, combat-edge markers, and downstream ambient/combat props outward to match the larger physical footprint. Boundary markers were left unchanged so the playable area framing remains coherent with the existing zone bounds.

- **`packages/content/src/data/spawnPoints.ts`**: Moved `nightmarket_spawn` deeper into the enlarged service hub so player arrival still feels centered in the town-services area after the spacing pass.

- **`packages/content/src/data/spawnZones.ts`**: Repositioned the Nightmarket Skitter, Runt, and Brute enemy pockets farther from town and farther from each other. This keeps the combat route readable while reducing the visual impression that hostiles are pressed directly against the town hub.

- **`packages/content/src/data/zones.ts`**: Enlarged `nightmarket.restAreaBounds` to match the widened service cluster so the existing server-authoritative rest/refill behavior still makes spatial sense with the new marker positions.

**Verification:**

- Focused validation is still pending.

**Known limitations:**

- This pass does not add waypoint travel, stash transfer, quest systems, collision/pathfinding, new town services, new enemy types, or any HUD/client interaction redesign.
- The improvement is intentionally content-driven: world positions changed, but the existing interaction logic, zoom, camera, hover feedback, loot pickup, and combat rules were left intact.

## Task 318 — Vendor Foundation: Open Basic Town Vendor Panel

**Summary:**

Implemented the first real town vendor interaction path. Clicking the Suspicious Vendor in the Nightmarket now opens a basic vendor panel backed by existing content data.

**Changes:**

- **`packages/content/src/data/townServices.ts`**: Added `nightmarket_suspicious_vendor` as a real town-service content definition with `serviceKind: "vendor"`, a localized `labelKey` and `unavailableMessageKey`.

- **`packages/content/src/data/types.ts`**: Extended `TownServiceId` union to include `"nightmarket_suspicious_vendor"`.

- **`packages/localization/src/LocaleTypes.ts`**: Added `town_service.suspicious_vendor.name` and `town_service.suspicious_vendor.unavailable` to `REQUIRED_LOCALIZATION_KEYS`.

- **`packages/localization/src/locales/en.ts`**: Added `"town_service.suspicious_vendor.name": "Suspicious Vendor"` and `"town_service.suspicious_vendor.unavailable": "Vendor trading is not available yet."` locale entries.

- **`apps/server/src/realtime/rooms/interactValidation.ts`**: Updated `getInteractableResponseMessage` for `nightmarket_vendor_01` to return the localized vendor name followed by a vendor greeting (`"Suspicious Vendor: 'What're you buyin'?'"`) instead of the previous `"Vendor trading is not available yet."` hardcoded string.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Updated the interact response handler for `nightmarket_vendor_01` to read the vendor label from `contentRegistry.townServices.get("nightmarket_suspicious_vendor").labelKey` via the localization `t()` function, eliminating the hardcoded `"Suspicious Vendor"` string.

**Verification:**

- `pnpm typecheck` — 0 errors
- `pnpm test` — all pass
- Pre-existing lint errors only (3 errors in unrelated files: `worldSessionAreaView.ts`, `worldSessionCursorFeedback.ts`)

**Known limitations:**

- No selling, buyback or vendor stock refresh/persistence
- No currency economy redesign

## Task 319 — Vendor Foundation: Server-Authoritative Buy Item

**Summary:**

Implemented the first real server-authoritative vendor buy action. Clicking the Buy button on a vendor stock item sends a `request_buy_vendor_item` message to the server. The server validates vendor existence, stock membership, price, player currency and inventory space, then atomically deducts copper and creates the inventory item. On success the client panel updates the money display; on failure a typed localized rejection reason is shown.

**Changes:**

- **`packages/shared/src/room/VendorBuyTypes.ts`**: New shared type file exporting `RequestBuyVendorItemRejectedReason` (`vendor_unavailable`, `item_unavailable`, `not_enough_currency`, `inventory_full`, `invalid_stock_entry`).

- **`packages/shared/src/protocol/ClientMessages.ts`**: Added `RequestBuyVendorItemClientMessage { type, vendorId, stockEntryId }` and included it in `ClientRoomMessage`.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added `RequestBuyVendorItemAcceptedServerMessage` (stockEntryId, itemId, priceCopper, remainingCopper) and `RequestBuyVendorItemRejectedServerMessage` (reason, stockEntryId?). Included both in `ServerRoomMessage`.

- **`packages/shared/src/index.ts`**: Re-exported `room/VendorBuyTypes`.

- **`apps/server/src/persistence/repositories/CharacterRepository.ts`**: Added `getMoneyCopper()` and `decrementMoneyCopper()` methods with atomic Prisma transactions and sufficient-funds guards.

- **`apps/server/src/realtime/rooms/vendorBuyItem.ts`**: New server module. `executeVendorBuyItem()` validates vendor content, stock entry membership, item definition, price positivity, player copper sufficiency, and inventory grid space. On success it atomically deducts copper and creates an `ItemInstance` in inventory via Prisma `$transaction`.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Registered `request_buy_vendor_item` async message handler. On acceptance sends `request_buy_vendor_item_accepted` + `currency_picked_up` (for HUD refresh). On rejection sends `request_buy_vendor_item_rejected` with a typed reason.

- **`packages/localization/src/locales/en.ts`**: Added `town_service.vendor_panel.buy_success`, `buy_rejected.not_enough_currency`, `buy_rejected.inventory_full`, `buy_rejected.item_unavailable`, `buy_rejected.vendor_unavailable`, `buy_rejected.invalid_stock_entry` keys.

- **`apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`**: Updated to accept `vendorId` and `onBuy` callback. Buy button is now active (enabled when player can afford). Panel exposes `updateMoney()` and `showFeedback()` methods. "Trading locked" note removed.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Wired `onBuy` callback to send `request_buy_vendor_item` through the Colyseus room. Added `request_buy_vendor_item_accepted` and `request_buy_vendor_item_rejected` message listeners. On success updates vendor panel money and shows localized feedback. On failure shows localized rejection message.

**Verification:**

- `pnpm typecheck` — 0 errors (all 5 workspace projects pass)
- Pre-existing lint errors only (unrelated to this task)

**Known limitations:**

- No selling, buyback, restock timers or dynamic prices
- No reputation or discount system
- No schema/database changes (existing `moneyCopper` field used)

## Task 320 — Vendor Foundation: Server-Authoritative Sell Item

**Summary:**

Implemented the first real server-authoritative vendor sell action. Clicking the Sell button on an inventory item in the vendor panel sends a `request_sell_item` message to the server. The server validates the item instance exists in the player's inventory, removes it atomically via Prisma `$transaction`, calculates the sell price (50% of vendor stock buy price, minimum 1 copper), credits copper, and responds with accepted/rejected feedback.

**Changes:**

- **`packages/shared/src/room/VendorSellTypes.ts`**: New shared type file exporting `RequestSellItemRejectedReason` (`vendor_unavailable`, `item_not_in_inventory`, `sell_unavailable`, `item_not_found`).

- **`packages/shared/src/protocol/ClientMessages.ts`**: Added `RequestSellItemClientMessage { type, vendorId, itemInstanceId }` and included it in `ClientRoomMessage`.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added `RequestSellItemAcceptedServerMessage` (itemInstanceId, definitionId, sellPriceCopper, remainingCopper) and `RequestSellItemRejectedServerMessage` (reason, itemInstanceId?). Included both in `ServerRoomMessage`.

- **`packages/shared/src/index.ts`**: Re-exported `room/VendorSellTypes`.

- **`apps/server/src/persistence/repositories/ItemRepository.ts`**: New repository module. `getItemInstanceWithOwner()` fetches an item with its owner character. `deleteItemInstance()` atomically removes an item instance by id. Used by the sell item service.

- **`apps/server/src/persistence/repositories/CharacterRepository.ts`**: Added `incrementMoneyCopper()` method with atomic Prisma transaction for crediting copper on sell.

- **`apps/server/src/realtime/rooms/vendorSellItem.ts`**: New server module. `executeVendorSellItem()` validates vendor content exists, fetches the item instance and verifies inventory ownership, calculates sell price from vendor stock data (50% ratio, minimum 1 copper), then atomically deletes the item and credits copper via Prisma `$transaction`.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Registered `request_sell_item` async message handler. On acceptance sends `request_sell_item_accepted`. On rejection sends `request_sell_item_rejected` with a typed reason.

- **`packages/localization/src/locales/en.ts`**: Added `town_service.vendor_panel.sell_header`, `sell_empty`, `sell_success`, `sell_rejected.item_not_in_inventory`, `sell_rejected.vendor_unavailable`, `sell_rejected.item_not_found`, `sell_rejected.sell_unavailable` keys.

- **`apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`**: Extended to accept `inventoryItems` and `onSell` callback. Added sell section below the stock section showing inventory items with name, sell price and Sell button. Added `updateInventory()` method for live refresh after sell.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Wired `onSell` callback to send `request_sell_item` through the Colyseus room. Added `request_sell_item_accepted` and `request_sell_item_rejected` message listeners. On success updates vendor panel money, inventory display, and refreshes account state. Added `buildInventoryItemsForSell()` helper that maps `inventorySummaryItems` from `CharacterSummary` to sellable items with client-side price preview.

**Verification:**

- `pnpm typecheck` — 0 errors (all 5 workspace projects pass)
- Pre-existing lint errors only (unrelated to this task)

**Known limitations:**

- No buyback system (sold items are permanently removed)
- No sell price negotiation or reputation discounts
- No schema/database changes (existing item instance and moneyCopper fields used)
- Client-side sell price is a preview; server is always authoritative

## Task 321 — WorldSession Playable View and Clickability Pass

**Summary:**

Improved the WorldSession play feel by reducing overlay obstruction, compacting the bottom HUD, tightening the top-left status chip, slightly increasing the default camera zoom, and lowering low-priority world-label noise in crowded areas. The pass keeps existing cursor feedback, move-then-act behavior, pickup/vendor flows, and zoom controls intact while making the visible world feel larger and easier to click through.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayLayout.ts`**: Reduced overlay root padding/gap and narrowed the HUD region width. Also reduced panel padding and softened panel box-shadow so the overall overlay footprint feels lighter and less dominant.

- **`apps/client/src/game/scenes/worldSession/worldSessionOverlayView.ts`**: Compacted the bottom HUD card spacing/padding, removed the redundant Resource mini-stat, and combined level + XP into one smaller mini-stat. Tightened the top-left character/status chip width, padding, and text sizes so it blocks less of the viewport while preserving player/location readability.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Increased the default camera zoom from `1.0` to `1.15` so the starting framing feels more playable and less cramped while preserving existing wheel and keyboard zoom controls.

- **`apps/client/src/game/scenes/worldSession/worldSessionStaticPropsView.ts`**: Reduced ambient creature label emphasis by shrinking ambient labels from `11px` to `9px`, muting their label color slightly, and removing the separate always-visible `Neutral` badge. Important service / area / boundary markers remain visible.

- **`apps/client/src/game/scenes/worldSession/worldSessionInteractablesView.ts`**: Reduced interactable label font size from `11px` to `10px` to slightly cut label stacking pressure in crowded town/service areas without changing authoritative click handling.

**Verification:**

- `pnpm --filter @doomscrolls/client typecheck` — passed
- `pnpm --filter @doomscrolls/client lint` — reports pre-existing unrelated lint errors in:
  - `apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`
  - `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`
  - `apps/client/src/game/scenes/worldSession/worldSessionCursorFeedback.ts`

**Known limitations:**

- This pass does not add a minimap, stash, waypoint travel, quests, or new gameplay systems
- Label decluttering is intentionally lightweight; it reduces low-priority noise but does not introduce a full overlap solver or hover-only label system for every object class
- Existing debug text inside the world viewport is unchanged outside the HUD/overlay compaction pass

## Task 322 — Targeted Client Lint Cleanup for WorldSession Vendor/UI Files

**Summary:**

Resolved the current targeted client lint issues in the WorldSession vendor/UI path with only mechanical cleanup. The changes remove unused code/imports and one unnecessary non-null assertion without changing vendor behavior, cursor feedback, move-then-act flow, clickability, combat feedback, inventory/equipment behavior, rest area feedback, or zoom behavior.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts`**: Removed an unused `computeClientSellPrice()` helper that was no longer referenced. Also replaced the Sell button handler’s non-null assertion with a direct call under the existing `onSell !== undefined` guard.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Removed the unused `previousHoverTargetId` variable left behind in the cursor-feedback hover path.

- **`apps/client/src/game/scenes/worldSession/worldSessionCursorFeedback.ts`**: Removed an unused localization import.

**Verification:**

- `pnpm eslint apps/client/src/game/scenes/worldSession/vendorInteractionPanel.ts apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts apps/client/src/game/scenes/worldSession/worldSessionCursorFeedback.ts` — 0 errors, 0 warnings

**Known limitations:**

- This task intentionally performs only targeted lint cleanup and does not change gameplay, vendor rules, UI structure, or broader client lint status outside the listed files

## Task 323 — Stash Foundation: Add Persistent Character Stash Schema

**Summary:**

Added the minimal persistent stash data foundation without introducing stash UI or item transfer behavior. The implementation reuses the existing `ItemInstance` persistence model and adds a new stash location path so future inventory ↔ stash features can move real persisted item instances without inventing a parallel item-storage system.

**Changes:**

- **`apps/server/prisma/schema.prisma`**: Added `STASH` to `ItemLocationType`, added nullable stash placement fields (`stashPage`, `stashX`, `stashY`) to `ItemInstance`, and added supporting indexes for character-scoped stash queries.

- **`packages/shared/src/inventory/ItemTypes.ts`**: Extended shared item location typing with a real `stash` location carrying `characterId`, `pageIndex`, `x`, and `y`.

- **`apps/server/src/persistence/mappers/itemMapper.ts`**: Added stash mapping support so persisted stash items can be projected through the existing item DTO path once a later task exposes them.

- **`apps/server/src/persistence/repositories/ItemRepository.ts`**: Added `listStashItems(characterId)` for basic character-scoped stash reads while preserving existing inventory/equipment methods.

**Verification:**

- Existing inventory/equipment/vendor persistence paths were audited against the shared `ItemInstance` location model before the stash schema change.
- No UI wiring or runtime stash behavior was added in this task.

**Known limitations:**

- No stash UI yet
- No inventory ↔ stash transfer flow yet
- No account-wide stash yet; current stash persistence is character-scoped via `ownerCharacterId`
- No stash page sizing, tab rules, sorting, or validation service yet

## Task 324 — Stash Foundation: Open Basic Town Stash Panel

**Summary:**

Implemented the first visible stash interaction path in the Nightmarket. Interacting with the Stash Keeper now opens a basic localized stash panel and lists the current character’s persisted stash items from the real `STASH` item location. The path is server-authoritative for listing only and does not introduce any fake transfer behavior.

**Changes:**

- **`packages/shared/src/room/StashTypes.ts`**: Added shared stash list rejection reasons for the room-driven stash listing contract.

- **`packages/shared/src/protocol/ServerMessages.ts`**: Added `stash_items_listed` and `stash_items_list_rejected` server messages. The listed payload returns shared `ItemInstance` DTOs so the client consumes the same persisted item shape already used elsewhere.

- **`packages/shared/src/index.ts`**: Re-exported the new stash shared types.

- **`apps/server/src/realtime/rooms/TownRoom.ts`**: Extended the existing `request_interact` stash keeper path. When `nightmarket_stash_keeper_01` is interacted with, the room now reads persisted stash rows using `ItemRepository.listStashItems(characterId)`, maps them through `toItemInstanceDto()`, and sends `stash_items_listed` back to the requesting client. Failures return a safe `stash_items_list_rejected` reason.

- **`packages/localization/src/LocaleTypes.ts`** and **`packages/localization/src/locales/en.ts`**: Added required localization keys and English strings for the stash panel title, foundation notice, empty state, page/position metadata, load failure feedback, and shared Close button text.

- **`apps/client/src/game/scenes/worldSession/stashInteractionPanel.ts`**: Added a new lightweight stash modal panel. It shows a localized title, a clear foundation-only notice, a localized empty state, and simple persisted-item rows. Item labels come from the existing content localization keys. Stash rows display existing persisted page/X/Y metadata only; no transfer controls or fake affordances are shown.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Replaced the stash placeholder town-service panel flow with the new stash panel. The scene now opens the stash panel on stash interaction and listens for `stash_items_listed` / `stash_items_list_rejected` to populate or safely fail the panel.

**Verification:**

- Existing Nightmarket stash keeper world prop and town service definitions were reused; no new schema changes were required beyond Task 323.
- Existing vendor, trainer, waypoint, inventory/equipment, movement, combat, rest area, cursor feedback, and area banner flows were left untouched by the stash-specific wiring.

**Known limitations:**

- No inventory → stash transfer yet
- No stash → inventory transfer yet
- No drag/drop or stash grid placement UI
- No sorting, filtering, tabs, or account-wide stash behavior
- The panel is intentionally foundation-only and lists persisted items without implying active item movement

## Task 325 — WorldSession Zoom, Projection, and Camera Range Fix

**Summary:**

Fixed the recent WorldSession zoom/projection regression so zoom changes apply immediately even while the player is idle, expanded the zoom range in both directions, and aligned the hit-test path with the current projection/camera state to reduce post-zoom click drift. The starting camera framing now shows more useful playable space by default while still allowing close inspection zoom.

**Changes:**

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added explicit camera zoom constants for minimum zoom (`0.55`), maximum zoom (`1.9`), default zoom (`1.0`), and zoom step (`0.1`). This replaces the previously more cramped default and narrower range.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated `setZoom()` so a zoom change immediately triggers `refreshFromRoomState()` using the latest active room reference. Zoom refresh no longer waits for player movement or a future Colyseus state update before projection/camera-dependent rendering catches up.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated pointer-to-world conversion to use the current projection context’s `projectionMode` directly, ensuring ground-click resolution uses the same live projection state that rendering uses after zoom/projection changes.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Added a cached `corpseScreenPositions` map and switched own-corpse hover/click hit-testing to use current projected screen positions plus current world coordinates. This removes one mixed-coordinate path that could drift after zoom and keeps corpse interaction aligned with the rendered marker.

- **`apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts`**: Updated projection-mode changes to also trigger an immediate refresh against the current room so camera/projection-dependent visuals and hit-testing stay synchronized when switching projection without waiting for later room activity.

**Verification:**

- Code audit confirmed the lag-fix guard remains intact: no new per-frame listener registration, no new repeated DOM creation, and no new unconditional full rebuild path was added.
- Runtime verification is still pending.

**Known limitations:**

- This task does not add new gameplay systems, stash transfer, waypoint travel, quests, or HUD rewrites.
- WorldSession still relies on the existing lightweight placeholder/view architecture; this task only fixes zoom/projection refresh and alignment within that structure.
