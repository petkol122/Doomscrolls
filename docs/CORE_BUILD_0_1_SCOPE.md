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
| 3 | WorldSession: enter town, enter combat, leave room | implemented — town ✅ + `CombatRoom` registered and wired with real combat (`request_move`, `request_attack`, `request_respawn`, enemy list via `initializeCombatEnemies`, simulation tick with enemy aggro/damage, movement stepping, respawn, onLeave persistence) ✅; CombatRoom client routing (UI button to join `combat`) is **deferred** — Core 0.1 combat gameplay exists in TownRoom's Nightmarket with full attack/dodge/flask/XP/loot/objectives |
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

After Tasks 268–270, all three original remaining blockers are now closed. See "Remaining 0.1 Blockers" below.

---

## Remaining 0.1 Blockers (Task 271 re-audit)

All three Task 267 blockers (CombatRoom real combat wiring, Brute heavy-attack telegraph field, flat inventory.items) are now closed after Tasks 268–270. The remaining Core 0.1 gap is:

1. **CombatRoom client routing (deferred for Core 0.1)**
   - `CombatRoom` itself is fully wired with real combat (enemies, movement, attack, simulation tick with aggro/damage, respawn, onLeave persistence).
   - Client-side UI to join the `combat` room (a button/transition from TownRoom or account shell) is explicitly deferred — Core 0.1 already has full combat gameplay in TownRoom's Nightmarket (click-to-move, attack, Grave Spark, dodge, flask, enemy AI, loot, XP, objectives, death/respawn/corpse).
   - Adding a CombatRoom join button would require changes to WorldSessionScene/account shell UI flow; this can ship post-Core-0.1 without blocking the build candidate.

No other true 0.1 blockers remain. The project is ready for a Build 0.1 candidate smoke checklist.
