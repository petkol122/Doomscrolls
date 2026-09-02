# docs/CORE_BUILD_0_18_PLAN.md — Core Build 0.18 Plan

## Theme: A Fourth Zone — Now With a Real Case, Not Just a Repeat

0.17 explicitly turned down a 4th zone: with all three existing combat
zones sharing the exact same shape (skirmisher + heavy, one loot table,
a rare, an epic family, two objectives), a fourth would have been a
third repetition of a now-formulaic pattern, and 0.17 found narrower,
cheaper gaps to close instead (enemy role parity, one rarity fix). This
build's brief reopens the door explicitly — "now actually on the table
again if the case is there" — so the bar is to show a 4th zone adds
something the existing three don't, not just one more of the same.

## The case: rare tier has a structural hole a 4th zone can close in one pass

Read directly from `items.ts` before proposing anything (rarity ×
equipment-slot matrix, all 24 current items):

| Slot | Common | Rare | Epic |
|---|---|---|---|
| weapon | starter_pipe | **none** | condemned_cleaver, livewire_lance, slagforged_maul |
| head | scavenged_hood | **none** | scavenger_king_helm |
| chest | sewer_jacket | **none** | warden_plate, chargeplate_vest, cinderplate_hauberk |
| hands | wraptape_gloves | **none** | static_wraps, cinderfist_gauntlets |
| feet | sewer_treads | voltbound_treads | none |
| belt | scrapcord_belt | slagbound_charm | none |
| ring_1 | none | rustbound_ring | none |
| amulet | none | signal_scarred_amulet | none |
| flask_1 | starter_blood_flask | none | none |

The four main gear slots — **weapon, head, chest, hands** — each jump
straight from common to epic with nothing between. That's a worse gap
than the one 0.17 closed (feet had *a* rare, just not one Static Yard
could call its own); this is four slots with *zero* rare-tier items at
all, a real cliff in the itemization curve, not a cosmetic ownership
gap. Rare is already the numerically thinnest tier (4 items, fewer than
epic's 9) — this is where the next rarity pass should go, not more
epics (epic is not thin anymore; adding a 10th epic wouldn't fix
anything a player actually experiences leveling gear).

A 4th zone is the right vehicle for that fix, not a detour from it:
every existing zone's rares and epics are zone-flavored drops with their
own identity (Blackwire's ring, Static Yard's treads, Cinderworks'
charm) — the same pattern naturally produces four zone-flavored rares
that happen to land exactly in the four empty slots, giving the new
zone a real, distinct itemization identity (**"the rare-tier zone"**)
instead of being a fourth copy of "1 rare + 3-item epic family." No new
epics ship this build — a deliberate choice, stated plainly rather than
padded in: this zone's contribution is entirely where the gap actually
is.

## The zone: Saltmere Docks

A flooded, salt-corroded dockyard — thematically distinct from sewage
(Blackwire), live current (Static Yard), and furnace heat (Cinderworks).
Sits in a previously-unused stretch of Nightmarket: checked directly
against every existing `worldProps.ts` coordinate, the entire west-
central region (`x < 1200, y > 1000`) has nothing in it but two far-west
boundary markers — genuinely free, and a different compass direction
from all three existing zone gates (NE/E/SE). Gate cluster lands around
`(400, 2200)`. Same shared `bounds: 0-800 x 0-600` and
`COMBAT_SPAWN_BOX` every combat zone already reuses.

**Enemies** (3, launched with full role parity from day one — unlike
Static Yard and Cinderworks, which launched with 2 and needed a 0.17
follow-up to reach the common/skirmisher/heavy structure Blackwire had
from the start):
- `brine_crawler` — common/starter tier
- `tide_stalker` — fast skirmisher
- `drowned_hauler` — heavy anchor with a telegraphed heavy attack

All three share one loot table (`saltmere_docks_loot`), matching the
one-table-per-zone precedent Static Yard/Cinderworks already established
over Blackwire's older three-way split.

**Items** (5 new): 1 common material (`brine_salt`, the zone's own
loot-table filler, same role `cinder_ash` plays for Cinderworks) and
4 rares — `tideworn_cutlass` (weapon), `brinemask_visor` (head),
`saltcrust_vest` (chest), `brinewrap_gloves` (hands) — one per empty
slot from the table above. Stat values were chosen to sit as a genuine
middle step between each slot's existing common and epic items (e.g.
chest: common `armor+2/maxHp+5` → new rare `armor+3/maxHp+10` → epic
`armor+5/maxHp+15`, a clean progression, not an arbitrary number).
Rare tier: 4 → 8 items (doubling); item total: 24 → 29.

**Objectives** (3, one per enemy, same zone-coverage pattern 0.15
established and every build since has reused): `brine_cull`,
`tide_hunt`, `hauler_purge`.

## Non-goals

No new epics (see above — deliberate, not an oversight). No balance
changes to existing zones/enemies/items. No new mechanics — spawn
zones, loot tables, zone-coverage objectives, and the
`COMBAT_ZONE_ROUTES` table are all pre-existing shapes being extended
with one more row each, exactly as Cinderworks proved in 0.16. Accessory
slots (`ring_1`, `amulet`) and the remaining epic gaps (`feet`, `belt`,
`flask_1`) stay open — named here as the next rarity-depth candidates,
not silently left unaddressed.

## File footprint (same shape as 0.16's Cinderworks addition)

`types.ts` (6 unions extended), `zones.ts`, `enemies.ts`, `items.ts`,
`lootTables.ts`, `spawnZones.ts`, `spawnPoints.ts`, `worldProps.ts`,
`objectives.ts` — content-data rows. `waypointService.ts` — one new
`COMBAT_ZONE_ROUTES` entry (data, not logic). `interactValidation.ts` —
one new gate-prompt branch (the one still-per-object-id spot every prior
zone has touched here too). `en.ts` + `LocaleTypes.ts` — new keys. No
`CombatRoom.ts`/`TownRoom.ts`/`initializeCombatEnemies.ts`/
`initializeCombatInteractables.ts` changes — confirmed by the same
reasoning 0.16/0.17 already verified for this exact file set.

## Verification

New `test/combat/saltmereDocksObjectiveCoverage.test.ts` (mirrors 0.16's
`cinderworksObjectiveCoverage.test.ts`): a `brine_crawler` kill in a
`saltmere_docks` `CombatRoom` advances `brine_cull` — proving the new
zone's full join → spawn → kill → objective-progress chain, not just
that the data is well-formed. `test/content/contentRegistryValidation.test.ts`
(0.16) re-validates automatically against every new row this build adds
— no changes needed there. Both the new test and the validator get the
standard regression-check (revert → confirm fail → restore → confirm
pass).

## Start-of-session check

Working tree confirmed to match exactly what 0.13–0.17 (+ the 0.15
hotfix, + the two post-0.17 investigation docs) left off — same file
set, nothing unexplained, still zero commits on top of `c211a10`.
`pnpm -r typecheck` clean; `pnpm --filter @doomscrolls/server test`
green (23 files / 34 tests) after one retry past the already-documented
transient Windows-native Prisma crash (see
`docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md`) — consistent with
prior sessions, not a new issue.
