# docs/CORE_BUILD_0_1_RELEASE_NOTES.md — Core Build 0.1 Candidate Release Notes

## What's Included

- **Account / login / register** — username/password registration, login, Bearer token auth, `/me` account state
- **Character create / select** — Sewer Dweller + Gravewalker, server-authoritative creation, per-account unique names, selected character persistence
- **Nightmarket + Blackwire Sewer Edge** — data-driven TownRoom with player presence, spawn zones, enemy populations
- **Movement / camera / zoom** — server-authoritative click-to-move, hold-move, camera follow, mouse wheel / PgUp/PgDn zoom
- **Combat, dodge, flask, Grave Spark** — left-click basic attack, RMB targeted skill with move-to-cast, Space dodge, Q healing flask with charges
- **Trashboar Runt / Skitter / Brute + Brute heavy attack** — three enemy variants with content-driven stats; Brute has distinct heavy-attack windup/cooldown/damage
- **Loot / copper / inventory / equipment** — server-authoritative loot drops, ground pickup, 10x6 grid inventory, equip/unequip with stat-modifier recalculation
- **Notice Board objective chain** — session-only "Cull Trashboars" → "Break the Brute" with XP + copper rewards, per-objective duplicate reward guard
- **XP / level / copper feedback** — server-owned XP gain, level-up with max HP increase, copper currency display, combat reward notices
- **Death / respawn / corpse recovery placeholder** — downed state, respawn at spawn point, corpse marker at death location, interact to recover
- **Town service placeholders** — Vendor, Stash Keeper, Trainer, Waypoint with dismissible panels and "not available yet" messages

## Validation Status

- `pnpm validate:0.1` — **PASS** (0 errors, 2 non-blocking warnings)
- Manual smoke re-test — **PASS** (all 20 steps verified against fresh local instance)

## Known Deferred Items

- Real vendors / stash / waypoint travel — placeholder panels only
- Quest log / persistence — Notice Board objectives are session-only
- Character customization — no appearance or cosmetic options
- CombatRoom client routing — `combat` room is wired server-side but has no client button to join it
- Real art / animation pipeline — all visuals are placeholder shapes/colors
- Safe-zone enforcement — Nightmarket is `test_hybrid` (has enemies) rather than a true safe hub
- Pathfinding / collision — movement is direct target approach with no obstacle awareness
- Drag/drop inventory, item comparison/stacking, gear durability/XP loss on death
- Multiple origins/classes, bosses, friends, guilds, PvP, procedural dungeons