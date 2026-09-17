# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.33] - 2026-09-07
### Added
- Nightmarket rebuilt at real-world Plzeň historic-center scale (19080×19613 units), grounded in real OpenStreetMap geography.
- All town services, gates, and spawn points relocated to real landmarks (Cathedral, City Hall, ČSOB branch, a pawnbroker, the Great Synagogue) via researched coordinate transforms.
### Fixed
- Player spawn point and several test fixtures still referenced old placeholder coordinates after the map rescale; migrated along with the rest of the zone.
- A prop-collision between the Trainer and the Blackwire Gate landmark points.

## [0.32] - 2026-09-07
### Added
- Real-world map screen (Leaflet.js + cached OpenStreetMap tiles) as an optional new entry point alongside "Enter World."
- New `world → continent → area` content hierarchy; existing zones migrated under a real Pilsen area with zero new zones invented.
### Fixed
- Missing Leaflet stylesheet import that caused map tiles and UI controls to render off-screen and fragmented.

## [0.31] - 2026-09-07
### Fixed
- Equipping gear mid-session now immediately updates live movement speed and attack cooldown in combat, closing the last of the stat fields that previously required a relog to take effect.

## [0.30] - 2026-09-06
### Added
- Lore content foundation: 12 flavor-text entries attached to origins, classes, zones, and enemies (data-layer only, not yet surfaced in any UI).

## [0.29] - 2026-09-07
### Added
- Room-local chat for both town and combat zones, with a per-session cooldown and message length cap.

## [0.28] - (undated)
### Added
- Other connected players are now visible while in combat zones (porting Core 0.27's town visibility into CombatRoom), including correct multi-player enemy aggro behavior.

## [0.27] - 2026-09-07
### Added
- Other connected players are now visible in town, rendered with a class-based color tint.

## [0.26] - 2026-09-06
### Added
- Inventory and equipment panels now render a real slot grid with rarity-colored item frames instead of plain text/boxes.

## [0.25] - 2026-09-06
### Changed
- Corner utility menu converted to a compact icon toolbar; bottom HUD now floats free of its old card background; game view now fills the browser window instead of a fixed letterboxed canvas.
### Fixed
- Menu icon clicks could leak through to the world and trigger character movement underneath the menu.

## [0.24] - 2026-09-04
### Added
- Enemies in combat zones (Blackwire Sewers, Static Yard, Cinderworks, Saltmere Docks) now actually acquire targets, telegraph, and land real retaliation damage — previously they sat idle indefinitely.
### Fixed
- Dodging no longer reliably fails to avoid a telegraphed hit in combat zones (enemies now hold position during their windup).

## [0.23] - 2026-09-04
### Added
- Item icons and enemy HP bar art integrated via a new visual-asset registry.
### Fixed
- Equipment panel never reflected real equip/unequip state due to a missing server broadcast, a message dropped before the scene was ready to receive it, and a stale version-cache bug — all three fixed.
- Equipping gear mid-session did not affect live damage or armor in combat until leaving and rejoining the room.

## [0.22] - 2026-09-03
### Added
- First real image-rendering pipeline in the client; Blackwire Sewers now renders a textured ground tile instead of a flat placeholder fill.

## [0.21] - 2026-09-03
### Changed
- Bottom HUD redesigned around a PoE-style HP/resource orb cluster and a 5-slot flask belt (one real slot, four visually-stubbed future slots).

## [0.20] - 2026-09-02
### Added
- A standing, repeatable "zone patrol" objective for every combat zone besides Blackwire Sewers, plus an extra enemy spawn pocket in Saltmere Docks to match the other zones' density.

## [0.19] - 2026-09-02
### Added
- 8 new items closing out the rarity matrix so every equipment slot now has a common, rare, and epic option; Static Yard's heavy enemy is now fully its own (no longer a reused Blackwire enemy).

## [0.18] - 2026-09-02
### Added
- Saltmere Docks, a fourth combat zone, adding the game's first rare-tier items for weapon/head/chest/hands slots.

## [0.17] - 2026-09-02
### Added
- A common-tier enemy for both Static Yard and Cinderworks (completing their enemy-role structure), one new rare item, and two matching objectives.

## [0.16] - 2026-09-02
### Added
- Cinderworks, a third combat zone, with two new enemies, a third epic item family, and two new objectives.

## [0.15] - 2026-09-02
### Added
- Two objectives can now be tracked at once; kills in Blackwire Sewers and Static Yard now count toward combat-zone objectives; the game's first repeatable objective.
### Fixed
- A race condition allowing a notice-board objective reward to be granted twice from rapid double-clicks.

## [0.14] - 2026-09-02
### Added
- A third combat action (`heavy_strike`) as a primary skill slot; dying in a combat zone now sends the player back to Nightmarket instead of a free in-place respawn.

## [0.13] - (undated)
### Fixed
- Players could spawn outside the map or in the wrong location when entering or leaving a combat zone, caused by a room-leave race condition and an incorrect landing-position calculation.

## [0.12] - 2026-09-01
### Fixed
- Dodge and healing flask inputs did nothing inside combat zones; both now work the same as they do in town.

## [0.11] - 2026-09-01
### Fixed
- Player armor now actually mitigates incoming enemy damage; previously the stat was computed and equippable but never consulted in combat.

## [0.10] - 2026-09-01
### Fixed
- Weapon damage stat modifiers now actually affect combat; basic attacks and skills were previously dealing fixed damage regardless of equipped gear.

## [0.9] - 2026-09-01
### Added
- Ironclad, the game's second playable class, a close-range physical bruiser with two new skills.
### Fixed
- Skill resolution was hardcoded to always resolve as the first class, silently mis-casting any other class's skills.

## [0.8] - 2026-09-01
### Added
- A persistent, real automated regression-test suite for the server (previously the "test" script only ran a typecheck).

## [0.7] - 2026-09-01
### Added
- A third item rarity tier (epic) with six new items, and a new skill (Bone Splinter) on a new tertiary skill slot.
### Fixed
- Skill casting was only wired up in town, not in either real combat zone; fixed so skills work in both.
### Fixed (hotfix)
- Combat-zone matchmaking could silently place a player into the wrong zone's already-open room.

## [0.6] - 2026-09-01
### Added
- Static Yard, the game's second combat zone, with its own enemy, layout, and loot table.
### Changed
- Zone routing generalized onto a content-driven table instead of hardcoded per-destination branches.

## [0.5] - 2026-09-01
### Added
- Items for all 5 previously-empty equipment slots; a distinct loot table for Trashboar Skitter.
### Fixed
- Gear comparison in the inventory panel had been silently broken since a prior build; fixed.

## [0.4] - 2026-06-15
### Added
- A conservative CombatRoom ↔ TownRoom travel handoff, a lightweight toggleable objective panel, a second data-driven notice-board objective, and minimal level/XP display polish.
### Fixed
- Reconnect and interrupted-transition recovery hardened so players no longer get stranded in an invalid room/zone state.

## [0.3] - 2026-06-12
### Added
- Real vendor buy/sell, persistent stash store/take, waypoint discovery and travel, and a town-to-combat-area route, closing the first full playable ARPG loop.
### Fixed
- Vendor panel failed to refresh inventory after a purchase; a currency notice could misleadingly show "picked up 0."

## [0.2] - (undated)
### Added
- Server-authoritative move-then-act (click-to-attack/pickup/interact out of range), boundary and safe-area markers, an area name banner, hit/damage feedback, and cursor target highlighting.
### Fixed
- Progressive FPS degradation during extended play sessions.
- Phantom player presence and stale overlays left behind after reconnect or leaving a room.

## [0.1] - (undated)
### Added
- Initial playable slice: account registration/login, character creation and selection, the Nightmarket hub and Blackwire Sewer Edge zone, server-authoritative movement and combat, three enemy types, loot/inventory/equipment, a notice-board objective chain, XP/leveling, and death/respawn with corpse recovery.
