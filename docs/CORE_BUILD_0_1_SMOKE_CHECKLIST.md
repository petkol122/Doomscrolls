# docs/CORE_BUILD_0_1_SMOKE_CHECKLIST.md — Core Build 0.1 Manual Smoke Checklist

## Purpose

Manual smoke checklist for validating a Core Build 0.1 candidate locally. Run through each step in order on a fresh local instance. No browser automation, no runtime reproduction, no gameplay changes.

---

## Prerequisites

```bash
# 1. Start local infrastructure
docker compose -f infra/compose/docker-compose.local.yml up -d

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client
pnpm --filter @doomscrolls/server prisma:generate

# 4. Run migrations
pnpm --filter @doomscrolls/server prisma:migrate:dev

# 5. Start server (terminal 1)
pnpm --filter @doomscrolls/server dev

# 6. Start client (terminal 2)
pnpm --filter @doomscrolls/client dev

# 7. Open http://localhost:5173 in browser
```

---

## Smoke Checklist

| # | Step | Pass | Fail | Notes |
|---|------|------|------|-------|
| 1 | **Install / env / migrate / start** — server starts without errors, client loads at localhost:5173 | ☐ | ☐ | |
| 2 | **Register** — create a new account with username + password, receive success response | ☐ | ☐ | |
| 3 | **Login** — log in with the registered credentials, see account shell with character list | ☐ | ☐ | |
| 4 | **Create character** — create a Sewer Dweller / Gravewalker character with a unique name | ☐ | ☐ | |
| 5 | **Select character** — select the created character from the list, Enter World enabled | ☐ | ☐ | |
| 6 | **Enter Nightmarket** — click Enter World, see "Connected to The Nightmarket." and player presence | ☐ | ☐ | |
| 7 | **Camera / movement / hold-move / zoom** — scroll wheel/PgUp/PgDn zoom works, hold left click on empty ground moves character, second click retargets mid-move | ☐ | ☐ | |
| 8 | **Interact with Notice Board** — click the gold Notice Board rectangle, see response message | ☐ | ☐ | |
| 9 | **Fight Trashboar Runt** — left-click the Runt enemy, see attack confirmation + HP decrease | ☐ | ☐ | |
| 10 | **Fight Trashboar Skitter** — find and attack a Skitter (faster, lower HP), verify behavior | ☐ | ☐ | |
| 11 | **Fight Trashboar Brute** — find and attack a Brute (tougher, deeper), verify higher durability | ☐ | ☐ | |
| 12 | **Verify Brute heavy telegraph** — observe Brute heavy-attack windup (distinct telegraph before damage lands) | ☐ | ☐ | |
| 13 | **Attack / Grave Spark / dodge / flask** — left-click basic attack works, RMB Grave Spark targets enemy (move-to-cast when out of range), Space dodge triggers, Q flask heals (check charge count) | ☐ | ☐ | |
| 14 | **Loot item / copper** — defeat an enemy, see ground loot appear, click to pick up, verify item appears in inventory + copper count increases | ☐ | ☐ | |
| 15 | **Inventory / equip / unequip** — open inventory panel, see looted items in grid, equip item to slot, unequip back to grid | ☐ | ☐ | |
| 16 | **Objective chain: Cull Trashboars → Break the Brute** — interact with Notice Board, get "Cull Trashboars" objective, defeat required runts, see progression; board then offers "Break the Brute", defeat required Brute, see completion | ☐ | ☐ | |
| 17 | **XP / level / copper feedback** — objective rewards grant XP (check level-up notice + max HP increase) and copper (check currency display), enemy kills also grant XP | ☐ | ☐ | |
| 18 | **Death / respawn / corpse recovery** — let enemy reduce HP to 0, see downed state, respawn at spawn point, walk back to death location, see corpse marker, interact to recover | ☐ | ☐ | |
| 19 | **Reconnect: HP / location / flask / inventory / equipment** — refresh browser, log in, select character, enter world; verify HP matches last saved value, position is near spawn, flask charges preserved, inventory items intact, equipment still equipped | ☐ | ☐ | |
| 20 | **Vendor / stash / trainer / waypoint placeholders** — interact with each town service NPC, see placeholder panel/dialog, no crashes | ☐ | ☐ | |

---

## Known Deferred (Not a Failure)

The following are explicitly deferred from Core Build 0.1. They will show placeholder-only behavior or no behavior at all. This is expected and not a failure:

- **Real vendors** — no trading, prices, vendor stock or buying/selling
- **Stash** — no stash storage, item deposit/withdrawal
- **Waypoint travel** — no teleport, zone change or waypoint persistence
- **Quest log / persistence** — Notice Board objectives are session-only; no permanent quest log
- **Character customization** — no appearance, avatar upload, cosmetic options
- **CombatRoom client routing** — the `combat` Colyseus room is wired server-side but there is no client UI button to join it; TownRoom Nightmarket already has full combat gameplay
- **Real art / animation pipeline** — all visuals are placeholder shapes/colors; no sprites, animations or final art
- **Drag/drop inventory** — equip/unequip works via button clicks; no drag/drop
- **Item comparison / stacking** — no compare tooltips or item stack merging
- **Gear durability / XP loss on death** — corpse recovery is visual/placeholder only
- **Multiple origins / classes** — Sewer Dweller + Gravewalker only
- **Bosses, friends, guilds, PvP, procedural dungeons** — all out of scope for Core 0.1