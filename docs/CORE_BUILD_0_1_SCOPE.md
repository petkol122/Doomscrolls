# docs/CORE_BUILD_0_1_SCOPE.md — Core Build 0.1 Scope Freeze

## Included Systems

### Account & Auth
- Username/password registration
- Login/logout with Bearer token authentication
- Session persistence (30-day expiry)
- `/me` endpoint for account state

### Character
- Character create with name validation
- Character select (per-account uniqueness)
- Sewer Dweller origin + Gravewalker class only
- Derived stats from origin/class

### WorldSession
- Town room (`town`) with The Nightmarket zone
- Combat room (`combat`) with Blackwire Sewer Edge
- Enter World / Leave buttons
- Room join validation (session + character ownership)

### Movement & Camera
- Server-authoritative click-to-move
- Movement speed derived from character stats
- Camera follow (debug top-down view)
- Zoom controls

### Combat
- Left-click attack (Heavy Strike)
- RMB Grave Spark targeted skill with move-to-cast
- Enemy family: Trashboar Runt, Skitter, Brute
- Brute heavy attack telegraph
- Server-validated damage/armor
- Dodge input (Space)

### Loot & Inventory
- Ground loot visuals + pickup
- Currency (copper) drops
- Grid inventory (10x6)
- Equipment slots + equip/unequip
- Stat modifiers on equipment
- Starter Blood Flask

### Objectives
- Notice Board with Objective 1 (Cull Trashboars)
- Notice Board with Objective 2 (Break the Brute)
- Session-only objective chain (no persistence)

### Death & Respawn
- Downed state at 0 HP
- Respawn at spawn point
- Corpse marker placeholder at death location
- Corpse recovery placeholder

### Town Services (Placeholders)
- Suspicious Vendor (no trading)
- Stash Keeper (no stash)
- Trainer (no training)
- Waypoint (no travel)

---

## Excluded Systems

```text
real vendors/stash/waypoint travel
quest persistence/log
safe-zone enforcement
auth redesign (OAuth, Google login, password reset)
character customization
housing/stealing/advanced currencies (gold, honor, crypto)
pathfinding/collision
real art/animation pipeline
second origin/class
bosses
friends/guilds
PvP
procedural dungeons
mobile app builds
cosmetic shop/monetization
admin panel
```

---

## Build 0.1 Acceptance Checklist

| # | Item | Status (Task 267 audit) |
|---|------|-------------------------|
| 1 | Account: register, login, logout, session handling | implemented |
| 2 | Character: create, select, derived stats | implemented |
| 3 | WorldSession: enter town, enter combat, leave room | partial — town ✅ + thin `CombatRoom` foundation registered (`combat` in `createRealtimeServer`) + leave covers both; `CombatRoom` is still a thin Colyseus shell (lifecycle only, no enemy list, no map, no movement, no combat, no message handlers, no simulation tick) — not yet real combat gameplay |
| 4 | Movement: click-to-move, speed-based, camera follow, zoom | implemented — click-to-move + speed-from-stats + zoom (mouse wheel + `+/-` keys in `worldSessionAreaView.ts`) ✅; `startFollow` style camera anchor is intentionally a debug top-down view, not real Diablo-style follow |
| 5 | Combat: attack, Grave Spark, dodge, enemy AI | partial — basic attack + Grave Spark + dodge + damage ✅; Skitter/Brute spawn zones wired in `packages/content/src/data/spawnZones.ts` ✅; Brute heavy-attack server logic wired in `TownRoom.applyEnemyAggroDamage` (reads `heavyAttackWindupMs` / `heavyAttackCooldownMs` / `heavyAttackChance` / `heavyAttackDamage` from content, sets `enemy.attackKind = "heavy"`, and exposes `missedKind` / `landingKind` for the message surface); `enemy_attack_telegraph` message surface still needs the explicit `attackKind: "heavy" \| "normal"` field for the client to render a distinct Brute telegraph |
| 6 | Inventory: grid, equip/unequip, Flask healing | partial — grid 10×6 + equip/unequip + flask charges/cooldown + stat-modifier recalc ✅ (`EquipmentService.recalculateEquippedCharacterStats()` + `TownRoom.applyProgressionUpdate()` use `calculateEquippedStats(modifiers, level)`); drag/drop + item comparison still missing |
| 7 | Loot: drop on defeat, pickup into inventory | partial — server-authored drops + pickup intent + persistence + full-inventory rejection (`PickupWorldLootFailureReason = "inventory_full"`) ✅; stacking still missing |
| 8 | Currency: copper drops, accumulation | implemented |
| 9 | Objectives: Notice Board chain, rewards | partial — board + 2 objectives + XP+copper rewards + duplicate guard + end-to-end XP via `xp_gained` message ✅; session-only, no persistence |
| 10 | Death/respawn: downed state, respawn, corpse | partial — downed + respawn + corpse marker + recovery intent ✅; recovery is visual/placeholder only (no gear/durability/XP loss) |
| 11 | Reconnect: restore character state after refresh | partial — session token + `/me` + persisted HP/location/flask + inventory grid items (`inventorySummaryItems` on `CharacterSummary`) + equipped items (`equippedItems: EquippedItemSummary[]` on `CharacterSummary` produced by `characterMapper.toCharacterSummaryWithInventoryDto`) + XP/level ✅ |
| 12 | Validation checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` | partial — real flat-config `eslint.config.mjs` (`typescript-eslint`) at repo root with `eslint .` scripts in all 5 workspace packages ✅; `pnpm lint` exits 0 on the current tree (0 errors, 4 non-blocking warnings); `pnpm typecheck` + `pnpm test` (tsc --noEmit) + `pnpm build` work; lint placeholder is gone, full lint gate is now actually enforced |

Legend: `implemented` = meets acceptance; `partial` = real flow exists but acceptance item is incomplete; `missing` = not implemented; `unstable/risky` = cannot be verified or depends on a placeholder.

### Notes on the previous (Task 261) audit

The Task 261 audit flagged several items as missing that are in fact already implemented under their real code path:

- camera follow + zoom — implemented as the debug-top-down `worldSessionAreaView` zoom controls; "camera follow" is intentionally not a Diablo-style follow-cam in the placeholder visual layer
- equipment stat-modifier recalc — implemented in `EquipmentService.recalculateEquippedCharacterStats()` and reused on level-up by `TownRoom.applyProgressionUpdate()`
- Skitter/Brute spawn wiring — `contentRegistry.spawnZones` ships `sewer_edge_trashboar_skitter_zone` and `sewer_edge_trashboar_brute_zone`, both read by `initializeTownEnemies`
- XP/level system — implemented as `levelProgression.ts` + `grantFlatXpReward()` + `xp_gained` message + `applyProgressionUpdate()` that re-runs the full equipped-stats recalc on level-up
- pickup full-inventory rejection — implemented in `pickupWorldLootInventory.ts` as `PickupWorldLootFailureReason = "inventory_full"` and surfaced as the "Inventory full." message

The only true 0.1 blockers that remain are: the `CombatRoom` actually wiring real combat / enemy / movement / loot / XP / objectives / message-handler state (it is still a thin Colyseus shell, not real combat gameplay), the explicit `attackKind: "heavy" | "normal"` field on the `enemy_attack_telegraph` message surface so the client can render a distinct Brute telegraph, and the flat `CharacterDetailsDto.inventory.items` summary path. See "Remaining 0.1 Blockers" below.

---

## Remaining 0.1 Blockers (Task 267 audit)

The four Task 262 blockers (real `pnpm lint`, Brute heavy-attack server logic, `/me` equipped-items exposure, `CombatRoom` foundation) are now closed. The thin `CombatRoom` shell is registered but is **not** real combat gameplay yet. Ordered by implementation dependency. Each block ships with tests + docs.

1. **`CombatRoom` real combat wiring** (Task 268)
   - Extend the current `CombatRoom` thin shell with enemy list, map, movement, combat, loot, XP, objectives and message handlers by reusing the existing shared helpers (no duplication of `TownRoom` gameplay).
   - Add a real `blackwire_sewers` combat spawn point to content and reuse a shared spawn resolver instead of `buildCombatPlayerPresence` falling back to `0,0` or the restored last location.
   - Tests: valid join + invalid ownership paths; presence/leave; one synced enemy interaction end-to-end; reuse of `applyMovementIntent` / `applyEnemyDamage` / `levelProgression` / pickup / flask / dodge / interact handlers.

2. **Brute heavy-attack telegraph message field** (Task 269)
   - The `TownRoom.applyEnemyAggroDamage` path now sources `heavyAttackWindupMs` / `heavyAttackCooldownMs` / `heavyAttackChance` / `heavyAttackDamage` from content and exposes `missedKind` / `landingKind` locally.
   - The `enemy_attack_telegraph` server message must carry the explicit `attackKind: "heavy" | "normal"` field so the client can render a distinct Brute telegraph.
   - Tests: deterministic RNG roll selects heavy attack within the configured chance; heavy-attack windup/cooldown values are sourced from content; non-Brute enemies never enter the heavy branch; the message envelope is type-checked.

3. **Flat `CharacterDetailsDto.inventory.items` summary** (Task 270)
   - `CharacterDetailsDto.inventory.items` is `[]` even after a real inventory write — fine for the current grid-only panel, but the `inventory.items` flat summary path is missing for clients that want flat item rendering.
   - Tests: one entry per actually persisted inventory item; ownership scope preserved; `equippedItems` and `inventorySummaryItems` are not duplicated.
