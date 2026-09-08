# docs/CORE_BUILD_0_20_PLAN.md — Core Build 0.20 Plan

## Theme: The Standing Objective, Everywhere Except Where It Started

## Why not a 5th zone

0.19 closed the last structural gap that justified a new zone (the
rarity-tier hole) and the last borrowed-enemy gap (Static Yard's heavy).
With those closed, a 5th zone is technically back on the table — but
"technically allowed" isn't a case. Checking for one:

- **Itemization**: every one of the 9 equipment slots now has common,
  rare, and epic representation (confirmed by computing the matrix
  directly from `items.ts`, not by trusting a prior build's notes).
  There's no missing tier anywhere for a new zone to fill.
- **Enemy roles**: every combat zone has an identical, fully-owned
  common/skirmisher/heavy roster. No zone is missing a role.
- **Zone-owned rare/epic identity**: every zone already has at least one
  slot it can call its own (Blackwire: ring, Static Yard: feet,
  Cinderworks: belt, Saltmere Docks: weapon/head/chest/hands rares).

Nothing measurable is missing that a 5th zone would be the right tool
to close. Shipping one anyway would be exactly the manufactured repeat
0.17 already declined once and 0.19 declined again for enemy roles.

## Why not more enemy roles either

Checked the same way: all 4 combat zones have exactly 3 enemy roles
(common/skirmisher/heavy), each zone-owned, each with a full-item
family behind it as of 0.19. There's no zone missing a role the way
Static Yard was missing its own heavy before 0.19. A 4th "elite" role
added to every zone with no concrete gap behind it would be decorative
padding, the same call made explicitly in 0.19's plan.

## The actual gap: objectives are the thinnest, most asymmetric system left

Reading `objectives.ts` in full turns up two real, concrete gaps that
line up with each other:

1. **`repeatable: true` is used by exactly one objective in the entire
   game** (`sewer_patrol`, added 0.15 specifically to prove the flag
   actually works end-to-end). Every objective added by 0.16, 0.17,
   0.18, and 0.19 — nine of them — is one-and-done. Static Yard,
   Cinderworks, and Saltmere Docks each have exactly 3 objectives (one
   per enemy role); once a player clears all 3, the Notice Board has
   nothing standing left to offer for that zone. Blackwire is the only
   zone with an evergreen reason to keep returning.
2. **Multi-enemy `targetEnemyIds` (kill any of several enemies toward
   one objective) only exists in Blackwire's two oldest objectives**
   (`cull_trashboars`, `sewer_cleanup`, both `[trashboar_runt,
   trashboar_brute]`). Every objective shipped since 0.15 targets
   exactly one enemy id. No zone besides Blackwire has ever had a
   "clear the zone in general" objective — only "kill this one specific
   role, four times."

Both gaps are mechanically already proven individually —
`advanceObjectiveProgress.ts` matches kills via
`targetEnemyIds.includes(enemyId)` generically (no per-objective
special-casing), and `TownRoom.ts`'s `isObjectiveRepeatable` is a plain
`objective.repeatable === true` check. But checking the test suite
turns up a third thing, not just named by 0.18/0.19-style release
notes but actually verified here: **no test has ever killed two
different enemy types against the same multi-target objective and
confirmed both advance it.** `concurrentObjectiveSlots.test.ts` kills a
runt and a brute, but against two *disjoint single-target* objectives
in two different slots — it never exercises `cull_trashboars` or
`sewer_cleanup`'s own 2-enemy `targetEnemyIds` array at all. That gap
gets closed by this build's own verification, not just its data.

## What ships: one "zone patrol" objective per zone that's missing one

`yard_patrol` (Static Yard), `cinder_patrol` (Cinderworks), `dock_patrol`
(Saltmere Docks) — each `repeatable: true`, each targeting all 3 of
that zone's own enemies (`targetEnemyIds` covering common + skirmisher
+ heavy), each `requiredKills: 2` / `xpReward: 3` / `copperReward: 2` —
copied exactly from `sewer_patrol`'s own numbers rather than invented,
just with the target pool generalized from 1 enemy to that zone's full
3-enemy roster. After this build every combat zone has the same
standing, always-available objective Blackwire has had since 0.15.

## Second, smaller fix: Saltmere Docks' spawn-density gap

Checked `spawnZones.ts` pocket-by-pocket while reading through
objectives: every combat zone gets one extra common-tier spawn pocket
beyond its "entrance cluster" — Static Yard's `static_yard_drudge_pocket`
(2), Cinderworks' `cinderworks_rat_pocket` (3) — except Saltmere Docks,
which never got the equivalent. Current totals: Blackwire 6, Static
Yard 8, Cinderworks 9, Saltmere Docks 6 — tied for lowest, and the only
one of the three post-0.16 zones without the extra pocket the other two
both got. Adds `saltmere_docks_crawler_pocket_south` (2x `brine_crawler`),
same mid-room coordinate pattern (`300-440, 300-420`) Static
Yard/Cinderworks already use for their own extra pocket. A new spawn
row, not a stat/balance change to any existing one — same kind of
addition every prior content build has made.

## Non-goals

No 5th zone, no new enemy roles (see above — checked, not just
declined). No balance/tuning changes to any existing item, enemy, or
objective's numbers. No new mechanics — `repeatable` and multi-target
`targetEnemyIds` both already exist and are both already exercised
individually; this build only combines them, which requires zero
`CombatRoom.ts`/`TownRoom.ts`/`advanceObjectiveProgress.ts` changes.

## File footprint

`objectives.ts` (3 new objectives + `NOTICE_BOARD_OBJECTIVE_SEQUENCE`),
`types.ts` (`ObjectiveId` extended), `spawnZones.ts` (1 new pocket),
`en.ts` + `LocaleTypes.ts` (new keys). No server room-logic files
touched — everything here is a new row in an existing table.

## Verification

`test/content/contentRegistryValidation.test.ts` re-checks the new rows
automatically — regression-checked the same way every prior build did
(temporarily typo an id, confirm it fails, restore). `sewer_patrol`
already proves the repeatable-restart cycle generically (0.15) for any
`repeatable: true` objective regardless of target count, so this build
doesn't re-prove that. What it does add: a third `it` in
`test/combat/staticYardObjectiveCoverage.test.ts` that starts
`yard_patrol` and kills a `static_wretch` (skirmisher) followed by a
`yard_drudge` (common) — two *different* target enemy ids against the
*same* multi-target objective — and asserts progress advances 0→1→2
and completes on the second, different-typed kill. That's the specific
thing nothing in the suite has exercised before. Regression-checked:
temporarily narrowed `yard_patrol`'s `targetEnemyIds` to
`["static_wretch"]` only, confirmed the second kill (yard_drudge) no
longer advances progress, restored, re-verified green.

## Start-of-session check

Working tree confirmed to match exactly what 0.13–0.19 left off (git
log still at `c211a10`, nothing committed since) — same file set,
nothing unexplained. `pnpm -r typecheck` clean before starting.
