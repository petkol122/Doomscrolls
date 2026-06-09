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

| # | Item | Status (Task 262 audit) |
|---|------|-------------------------|
| 1 | Account: register, login, logout, session handling | implemented |
| 2 | Character: create, select, derived stats | implemented |
| 3 | WorldSession: enter town, enter combat, leave room | partial — town ✅, CombatRoom missing, leave covers town only |
| 4 | Movement: click-to-move, speed-based, camera follow, zoom | implemented — click-to-move + speed-from-stats + zoom (mouse wheel + `+/-` keys in `worldSessionAreaView.ts`) ✅; `startFollow` style camera anchor is intentionally a debug top-down view, not real Diablo-style follow |
| 5 | Combat: attack, Grave Spark, dodge, enemy AI | partial — basic attack + Grave Spark + dodge + damage ✅; Skitter/Brute spawn zones wired in `packages/content/src/data/spawnZones.ts` ✅; Brute-specific heavy-attack window server logic missing (`heavyAttackWindupMs` / `heavyAttackCooldownMs` / `heavyAttackChance` / `heavyAttackDamage` are defined in content but never read by `applyEnemyAggroDamage` — only the global `ENEMY_ATTACK_WINDUP_MS = 350` is used) |
| 6 | Inventory: grid, equip/unequip, Flask healing | partial — grid 10×6 + equip/unequip + flask charges/cooldown + stat-modifier recalc ✅ (`EquipmentService.recalculateEquippedCharacterStats()` + `TownRoom.applyProgressionUpdate()` use `calculateEquippedStats(modifiers, level)`); drag/drop + item comparison still missing |
| 7 | Loot: drop on defeat, pickup into inventory | partial — server-authored drops + pickup intent + persistence + full-inventory rejection (`PickupWorldLootFailureReason = "inventory_full"`) ✅; stacking still missing |
| 8 | Currency: copper drops, accumulation | implemented |
| 9 | Objectives: Notice Board chain, rewards | partial — board + 2 objectives + XP+copper rewards + duplicate guard + end-to-end XP via `xp_gained` message ✅; session-only, no persistence |
| 10 | Death/respawn: downed state, respawn, corpse | partial — downed + respawn + corpse marker + recovery intent ✅; recovery is visual/placeholder only (no gear/durability/XP loss) |
| 11 | Reconnect: restore character state after refresh | partial — session token + `/me` + persisted HP/location/flask + inventory grid items (`inventorySummaryItems` on `CharacterSummary`) + XP/level ✅; equipped items are NOT included in `CharacterSummary` (no `equippedItems` field), so equipped-slot UI cannot render from `/me` alone — equipment persistence is on disk, only the summary is missing |
| 12 | Validation checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` | partial — `pnpm typecheck` + `pnpm test` (tsc --noEmit) + `pnpm build` work; `pnpm lint` is `echo ... placeholder` in all 5 workspace packages, ESLint is installed but not configured — full lint gate not actually enforced |

Legend: `implemented` = meets acceptance; `partial` = real flow exists but acceptance item is incomplete; `missing` = not implemented; `unstable/risky` = cannot be verified or depends on a placeholder.

### Notes on the previous (Task 261) audit

The Task 261 audit flagged several items as missing that are in fact already implemented under their real code path:

- camera follow + zoom — implemented as the debug-top-down `worldSessionAreaView` zoom controls; "camera follow" is intentionally not a Diablo-style follow-cam in the placeholder visual layer
- equipment stat-modifier recalc — implemented in `EquipmentService.recalculateEquippedCharacterStats()` and reused on level-up by `TownRoom.applyProgressionUpdate()`
- Skitter/Brute spawn wiring — `contentRegistry.spawnZones` ships `sewer_edge_trashboar_skitter_zone` and `sewer_edge_trashboar_brute_zone`, both read by `initializeTownEnemies`
- XP/level system — implemented as `levelProgression.ts` + `grantFlatXpReward()` + `xp_gained` message + `applyProgressionUpdate()` that re-runs the full equipped-stats recalc on level-up
- pickup full-inventory rejection — implemented in `pickupWorldLootInventory.ts` as `PickupWorldLootFailureReason = "inventory_full"` and surfaced as the "Inventory full." message

The only true 0.1 blockers that remain are: `CombatRoom`, Brute heavy-attack window server logic, equipment exposure in the `/me` summary, and a real ESLint config / non-placeholder `pnpm lint`. See "Remaining 0.1 Blockers" below.

---

## Remaining 0.1 Blockers (Task 262 audit)

Ordered by implementation dependency. Each block ships with tests + docs.

1. **Real ESLint config / `pnpm lint`** (Task 263)
   - Replace the 5 `echo ... lint placeholder` scripts with a real flat-config ESLint setup at the repo root plus a small per-workspace ignore pattern.
   - Wire `pnpm lint` to run all of them.
   - Add `eslint-config-prettier` and `eslint-plugin-@typescript-eslint` minimal rules.
   - Outcome: `pnpm lint` exits non-zero on real code issues; CI can enforce the full gate.

2. **Brute heavy-attack server logic** (Task 264)
   - Read `heavyAttackWindupMs` / `heavyAttackCooldownMs` / `heavyAttackChance` / `heavyAttackDamage` from the enemy content definition in `applyEnemyAggroDamage`.
   - On the chosen heavy-attack tick, set `enemy.attackKind = "heavy"`, set the windup from content (not the global constant), and apply `heavyAttackDamage` instead of `damage` on landing.
   - Make the `enemy_attack_telegraph` message include `attackKind: "heavy" | "normal"` so the client can render a distinct Brute telegraph.
   - Tests: deterministic RNG roll selects heavy attack within the configured chance; heavy-attack windup/cooldown values are sourced from content; non-Brute enemies never enter the heavy branch.

3. **`/me` equipped-items exposure** (Task 265)
   - Extend `CharacterSummary` (or add a new `equippedItems` field on `CharacterDetails` consumed by `/me`) to expose one entry per equipped item: `itemInstanceId`, `definitionId`, `slot`, `label`, `category`, `rarity`, `statModifiers`.
   - Have `toCharacterSummaryWithInventoryDto` (or the `/me` path) include both inventory grid items and equipped items in a single safe DTO.
   - Update `apps/client/src/net/...` consumers to render the equipped-slot UI from the new field.
   - Tests: summary returns one entry per actually equipped item; ownership scope is preserved; the field is absent when the character has nothing equipped.

4. **`CombatRoom` for Blackwire Sewer Edge** (Task 266 — the final 0.1 blocker)
   - Mirror `TownRoom` shape: `CombatRoomState` with `roomKind: "combat"`, `zoneId: "blackwire_sewers"`, `playerPresence: MapSchema<PlayerPresence>`.
   - Register as `combat` in `createRealtimeServer`.
   - Reuse existing `validateMovementIntent` / `applyMovementIntent` / `validateAttackIntent` / `applyEnemyDamage` / `levelProgression` / pickup / flask / dodge / interact handlers.
   - Add a `combatEdge` transition prop content entry if needed so a joined player can move from Nightmarket into the combat room zone.
   - Reuse `RoomJoinValidationService.validateJoin({ roomKind: "combat", ... })` (already accepts `combat`).
   - Tests: valid join + invalid `roomKind` / `zoneId` / character ownership paths; presence/leave; one synced enemy interaction end-to-end.
