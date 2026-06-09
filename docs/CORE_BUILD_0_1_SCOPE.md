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

| # | Item | Status (Task 261 audit) |
|---|------|-------------------------|
| 1 | Account: register, login, logout, session handling | implemented |
| 2 | Character: create, select, derived stats | implemented |
| 3 | WorldSession: enter town, enter combat, leave room | partial — town ✅, combat room missing, leave covers town only |
| 4 | Movement: click-to-move, speed-based, camera follow | partial — click-to-move + speed-from-stats ✅, camera follow + zoom missing |
| 5 | Combat: attack, Grave Spark, dodge, enemy AI | partial — basic attack + Grave Spark + dodge + damage ✅, Brute heavy-attack telegraph missing, Skitter/Brute not wired to spawn zones |
| 6 | Inventory: grid, equip/unequip, Flask healing | partial — grid 10×6 + equip/unequip + flask charges/cooldown ✅, stat-modifier recalc missing, drag/drop + comparison missing |
| 7 | Loot: drop on defeat, pickup into inventory | partial — server-authored drops + pickup intent + persistence ✅, no stacking, no free-grid validation on pickup |
| 8 | Currency: copper drops, accumulation | implemented |
| 9 | Objectives: Notice Board chain, rewards | partial — board + 2 objectives + XP+copper rewards + duplicate guard ✅, session-only, no persistence, end-to-end XP reward not verified |
| 10 | Death/respawn: downed state, respawn, corpse | partial — downed + respawn + corpse marker + recovery intent ✅, recovery is visual/placeholder only (no gear/durability/XP loss) |
| 11 | Reconnect: restore character state after refresh | partial — session token + /me + persisted HP/location/flask ✅, inventory/equipment/XP not restored on refresh |
| 12 | Validation checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` | unstable/risky — `pnpm lint` is a placeholder echo, no real ESLint config, full gate not actually enforced |

Legend: `implemented` = meets acceptance; `partial` = real flow exists but acceptance item is incomplete; `missing` = not implemented; `unstable/risky` = cannot be verified or depends on a placeholder.
