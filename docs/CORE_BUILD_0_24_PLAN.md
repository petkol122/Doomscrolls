# docs/CORE_BUILD_0_24_PLAN.md — Core Build 0.24 Plan

## Status

**Planning phase — STOP for review.** Unlike recent content builds (0.21-0.23), this is a foundational combat-logic fix touching all four combat zones' core damage loop. Per explicit instruction, this plan is not to be collapsed into a single implementation pass. No runtime code changes are part of this task.

---

## Core 0.24 Theme

**CombatRoom Enemy Retaliation — Closing the "Deferred" Gap**

---

## Build Framing — Current State (audited 2026-09-04)

### The gap, confirmed at the exact call sites

`CombatRoom.ts`'s own doc comment on `applyCombatEnemyAggroDamage` ([CombatRoom.ts:1509-1531](apps/server/src/realtime/rooms/CombatRoom.ts#L1509-L1531)) says outright:

> "NOTE: This is intentionally a small CombatRoom-only loop, not a copy of the full TownRoom aggro-damage block. Full enemy AI (wander, leash-out, multi-target re-acquire, heavy attacks, aggro transfer between players, etc.) is deferred to a shared helper extraction task — see `docs/BACKLOG_CORE_0_1.md` "CombatRoom enemy AI helper extraction"."

That backlog entry does not exist — a full-text search of `docs/BACKLOG_CORE_0_1.md` for it returns nothing. The deferred follow-up was never tracked, and it never happened.

Every assignment of `enemy.targetPlayerSessionId` in `CombatRoom.ts` sets it to `""` ([line 606](apps/server/src/realtime/rooms/CombatRoom.ts#L606) on disconnect, [line 1596](apps/server/src/realtime/rooms/CombatRoom.ts#L1596) on kill, [line 1680](apps/server/src/realtime/rooms/CombatRoom.ts#L1680) on respawn, plus init in [initializeCombatEnemies.ts:69](apps/server/src/realtime/rooms/initializeCombatEnemies.ts#L69)). **No line anywhere assigns it to a real session id.** `applyCombatEnemyAggroDamage`'s own logic ([lines 1539-1550](apps/server/src/realtime/rooms/CombatRoom.ts#L1539-L1550)) is entirely gated on `targetPlayer !== undefined`, which — because nothing ever populates `targetPlayerSessionId` — is never true. Every enemy in every one of the 4 combat zones sits in `"idle"` forever.

**Consequence, confirmed by full-file review: a player cannot take damage anywhere in CombatRoom, by any path, today.** There is no trap/hazard damage, no other `hp -=` write site. Enemies can be killed for XP/loot with zero risk in Blackwire Sewers, Static Yard, Cinderworks, and Saltmere Docks.

### TownRoom already has the correct version

`TownRoom.applyEnemyAggroDamage` ([TownRoom.ts:3346-3635](apps/server/src/realtime/rooms/TownRoom.ts#L3346-L3635)) is a complete, working implementation:

1. **Proximity-based target acquisition** ([3418-3448](apps/server/src/realtime/rooms/TownRoom.ts#L3418-L3448)) — each enemy independently scans all connected alive players and locks onto the nearest one within `aggroRange`, deferring to a leash-return buffer if the enemy is mid-return.
2. **Leash / return-to-spawn** ([3386-3416](apps/server/src/realtime/rooms/TownRoom.ts#L3386-L3416)) — drops target and walks back to spawn if the target dies, disconnects, leaves aggro range, or the enemy itself exceeds `leashRange` from spawn.
3. **Telegraph → windup → landing state machine** ([3476-3634](apps/server/src/realtime/rooms/TownRoom.ts#L3476-L3634)) — server-authoritative: starts a telegraph when in range and off cooldown, re-validates range/life at landing time (a dodge or death before landing resolves as a miss), then calls `mitigateIncomingDamage(rawDamage, armor)` ([line 3540](apps/server/src/realtime/rooms/TownRoom.ts#L3540)) before applying to `hp`.
4. **Heavy attacks** ([3362-3376](apps/server/src/realtime/rooms/TownRoom.ts#L3362-L3376), [3594-3620](apps/server/src/realtime/rooms/TownRoom.ts#L3594-L3620)) — a per-tick eligibility check (all four heavy fields present) plus a chance roll on each new telegraph, feeding a distinct `attackKind: "heavy"` through the same mitigation call.

`mitigateIncomingDamage` ([incomingDamageMitigation.ts](apps/server/src/realtime/rooms/incomingDamageMitigation.ts)) is already shared between both rooms — the only two call sites in the codebase. Its formula, unchanged since 0.11: `Math.max(1, floor(rawDamage) - max(0, armor))` — flat, additive, floor of 1 HP lost per landed hit, no percentage/diminishing-returns curve.

### The schema already supports full parity — this is wiring, not new design

`EnemyPresence` (`packages/shared/src/room/EnemyPresence.ts`), the schema class shared by both rooms, already declares `spawnX`/`spawnY`, `attackKind`, and `nextHeavyAttackAtMs`. `initializeCombatEnemies.ts` ([lines 64-77](apps/server/src/realtime/rooms/initializeCombatEnemies.ts#L64-L77)) already sets `spawnX`/`spawnY` at spawn and resets `attackKind = "normal"` / `nextHeavyAttackAtMs = 0` on every spawn and respawn — fields CombatRoom's own damage logic never reads. The shared pure helpers this port needs (`moveEnemyTowardTarget`, `moveEnemyTowardPoint`, `clearEnemyTargetAndReturn`, `resetEnemyCombatState`, `ENEMY_ATTACK_RANGE`/`ENEMY_RETURN_REACQUIRE_BUFFER`/`ENEMY_RETURN_ARRIVAL_DISTANCE`) already live in `enemyAiHelpers.ts` and are already imported by `CombatRoom.ts`. **No schema change and no new shared-helper file is required.** This is the same shape every prior TownRoom-only-gap fix has been (0.9 skill slots, 0.12 dodge/flask): port the logic, don't invent it.

**Revision (post-review):** 0.24 deliberately does not read the heavy-attack fields despite the schema already carrying them — see Question 1 below. `attackKind` stays hardcoded to `"normal"` for this build, exactly as CombatRoom's current code already does; only the acquisition/leash/telegraph/landing logic around it is being fixed.

---

## Question 1 — Scope of Parity: Heavy Attacks and Multi-Enemy Aggro

**Revised recommendation: normal-hit-only parity for 0.24. Heavy attacks are cut from this build and become a named, queued follow-up (see "Queued Follow-Up" below), ported and live-verified separately once basic retaliation is confirmed sound on its own.**

**Why the cut:** basic single-target retaliation (an enemy acquiring a player and landing its normal `damage`) and heavy attacks (a second, higher-damage branch with its own eligibility/chance/cadence logic) are two independently untested mechanisms. Landing both in the same build means that if the live Playwright check turns up something that reads as broken — an unexpected death, an attack that feels unfair — there is no way to tell from that result alone whether the *base* targeting/telegraph/landing loop is at fault or the *heavy* branch layered on top of it is. Shipping and live-verifying the base mechanism first, then adding heavy attacks as its own small, isolated follow-up build, means any live-check finding has exactly one candidate cause. This is a sequencing decision, not a scope judgment about whether heavy attacks belong in CombatRoom at all — the case made in the original draft of this plan (zero schema cost, direct port of proven logic, already-authored content going unused) still holds and is exactly why the follow-up is queued immediately, not indefinitely deferred.

**What "normal-hit-only" means concretely for the port:** every enemy — including the three heavy anchors (Arc Sentinel, Foundry Warden, Drowned Hauler) and the reused Trashboar Brute — only ever lands its normal `damage` value in CombatRoom this build. `attackKind` stays hardcoded to `"normal"` (matching CombatRoom's current, already-written literal), and `heavyAttackWindupMs`/`heavyAttackDamage`/`heavyAttackCooldownMs`/`heavyAttackChance`/`nextHeavyAttackAtMs` are read by nobody in CombatRoom this build, exactly as today. This does **not** change any enemy's HP, aggro range, leash range, or normal-attack cooldown — those are unaffected by the cut.

**Multi-enemy aggro stays in scope, unchanged from the original recommendation.** This isn't a second untested mechanism the way heavy attacks are — it's the same proximity-based single-target-per-enemy acquisition loop (`TownRoom.ts:3421-3431`) simply applied once per enemy, with no additional logic layered on top. Restricting it to "only one enemy may ever have a target at a time" would mean rewriting the ported acquisition loop into an artificially different shape, which cuts against "port, don't invent." Each enemy still independently locks onto whichever alive player is nearest; multiple enemies (e.g. a 3-enemy pocket) can each independently target the same or different players, exactly as TownRoom already does today in Nightmarket.

**What's explicitly still out of scope:** heavy attacks (queued follow-up, see below), ranged enemies, pack coordination, aggro-transfer-on-damage-dealt (an enemy currently only re-targets when its current target dies/leaves, same as TownRoom), threat tables, and any new enemy AI states. All four combat zones' enemy roster and AI states (`idle`/`chasing`/`returning`/`defeated`) stay exactly as authored.

### Queued Follow-Up: Heavy Attack Parity

A small, separately-planned build (working name: "CombatRoom Heavy Attack Parity"), to run immediately after 0.24 is live-verified, not left indefinitely open the way the original "shared helper extraction task" reference rotted into a phantom pointer (see Build Framing above). Scope sketch: read `heavyAttackWindupMs`/`heavyAttackDamage`/`heavyAttackCooldownMs`/`heavyAttackChance` and the eligibility/chance-roll logic already proven in `TownRoom.ts:3362-3376` and `3594-3620`, applying it to CombatRoom's now-working telegraph/landing loop. Its own live Playwright check should specifically target the never-before-fired 7-damage hit (Arc Sentinel/Foundry Warden/Drowned Hauler), in isolation, so any surprise there is attributable to the heavy branch alone. This item should be named explicitly in 0.24's release notes as the very next queued build, not filed away as a vague "later."

---

## Question 2 — Balance Sanity Check (done before implementation)

### Player HP / armor / damage, by level and gear

| | Base stats (origin `sewer_dweller` + class) | L1 maxHp | L1 damage | L10 maxHp (before gear +HP) |
|---|---|---|---|---|
| Gravewalker | power 4, toughness 5, speed 3 | 20 + 5×5 = **45** | 1+4 = **5** | 45 + 9×3 = **72** |
| Ironclad | power 5, toughness 7, speed 0 | 20 + 7×5 = **55** | 1+5 = **6** | 55 + 9×3 = **82** |

(`maxHp = 20 + toughness×5 + (level-1)×3`, `damage = 1 + power`, `CharacterStatsService.ts`.) Base armor is always **0** before gear — there is no innate armor stat.

Realistic simultaneously-equipped armor (only one item per slot counts, so this is not a sum of every armor item in the game):

| Loadout tier | Armor |
|---|---|
| Unarmored (fresh character) | 0 |
| Realistic common gear | ~4 |
| Realistic rare gear | ~8 |
| Realistic max epic gear (best-in-slot: head+3, chest+5, feet+2, belt+2, ring+2) | **14** |

This **14** is higher than the **9** the 0.11 plan computed — three epic items added in 0.16-0.19 (feet, belt, a second ring) raised the ceiling by +5 since that check was last done. **No level gating exists for any combat zone** — nothing stops a fresh, unarmored level-1 character from walking directly into Saltmere Docks, the content-wise "deepest" zone, on their first visit. This is addressed as an explicit decision in Question 4 below, not left as an open risk.

### Enemy roster and the mitigation floor (0.24 scope: normal hits only)

Heavy-attack values are listed for reference and for the queued follow-up build's own planning — **none of them are exercised by 0.24**, since heavy attacks are cut (Question 1).

| Zone | Common enemies (dmg / cooldown) | Heavy anchor (HP, normal dmg — the only damage it deals in 0.24) | Heavy dmg (not live in 0.24; follow-up build only) |
|---|---|---|---|
| Blackwire Sewers | Runt 2/1050ms, Skitter 1/980ms | Trashboar Brute — 30 HP, 3 normal | 6 |
| Static Yard | Wretch 2/900ms, Drudge 2/1000ms | Arc Sentinel — 34 HP, 4 normal | 7 |
| Cinderworks | Ash Rat 1/950ms, Slag Hound 2/900ms | Foundry Warden — 34 HP, 4 normal | 7 |
| Saltmere Docks | Brine Crawler 2/1000ms, Tide Stalker 2/900ms | Drowned Hauler — 34 HP, 4 normal | 7 |

Mitigation (`max(1, raw - armor)`), applied to the damage values 0.24 actually lands (1-2 common, 4 heavy-anchor normal — the 6-7 heavy row is included only to show what the follow-up build inherits):

| Raw hit | Armor 0 | Armor 4 | Armor 8 | Armor 14 |
|---|---|---|---|---|
| 1-2 (common enemies) | 1-2 | 1 (floored) | 1 | 1 |
| 4 (heavy-anchor normal — the hardest hit 0.24 ever lands) | 4 | 1 (floored: `max(1, 4-4)=1`) | 1 | 1 |
| 6-7 (heavy hit — follow-up build only, not live in 0.24) | 6-7 | 2-3 | 1 (floored at armor 6-7+) | 1 |

This reconfirms 0.11's own finding: **any armor at all floors nearly the entire common-enemy roster to 1 HP per hit**, and a heavy anchor's normal hit floors by armor ~4. With heavy attacks cut, **4 raw damage is the single hardest hit 0.24 can ever land on a player** — a meaningfully smaller ceiling than the 6-7 the original draft of this plan had to account for. This is an existing, already-accepted mitigation-formula tradeoff (0.11 explicitly declined to change it) — not new to this build.

### Time-to-kill / worst-case scenarios (normal hits only)

**Revision (post-review): the single-hit ceiling (4 raw damage) is not the real worst-case bound — multi-enemy aggro was staying in scope (Question 1) and had not yet been walked through as its own scenario, distinct from "one pocket, DPS estimated loosely." Done properly below, using the exact per-pocket enemy counts and stats.**

Spawn-pocket layout (`spawnZones.ts`) keeps enemy groups spatially separated (pockets 180-380 world units apart; aggro range 144-204 wu depending on enemy type) — a player engages **one pocket at a time** under normal play, not the full zone roster simultaneously. But several pockets are tight enough (110-150 wu across, smaller than the 144-204 wu aggro radius) that a player standing centrally inside one is in aggro range of every enemy in it, not just the nearest — this is a real, easily-reachable case, not an edge case requiring unusual positioning.

The largest same-pocket counts, by zone (`spawnZones.ts`):

| Pocket | Enemy | Count | Dmg | Cooldown | Combined raw DPS |
|---|---|---|---|---|---|
| `static_yard_wretch_pocket_north` | Static Wretch | 3 | 2 | 900ms | **6.67** |
| `cinderworks_hound_pocket_north` | Slag Hound | 3 | 2 | 900ms | **6.67** |
| `saltmere_docks_crawler_pocket_north` | Brine Crawler | 3 | 2 | 1000ms | 6.00 |
| `cinderworks_rat_pocket` | Ash Rat | 3 | 1 | 950ms | 3.16 |
| `blackwire_sewers_runt_pocket_west`/`_east` | Trashboar Runt | 2 | 2 | 1050ms | 3.81 |

- **Real worst case: a full 3-enemy pocket pull (Static Yard's wretch-north or Cinderworks' hound-north), unarmored L1, fully passive:** 6.67 combined raw DPS. A 45 HP Gravewalker goes down in **~6.75 seconds**; a 55 HP Ironclad in **~8.25 seconds** — both faster than the solo-heavy-anchor case below (~10-12s). **This, not the single 4-damage hit, is 0.24's actual worst-case exposure.** The three newer zones' tight 150×120-unit common pockets make this a sharper number than Blackwire Sewers' own 2-enemy runt pockets (3.81 DPS) or Nightmarket's identical `trashboar_runt` pocket (same content, but spread across a much looser 500×420-unit box that doesn't guarantee a full simultaneous pull) — so "Blackwire Sewers inherits zero incremental risk from Nightmarket" (as stated elsewhere in this section) is true for Blackwire specifically, but does **not** extend to the three newer zones' tighter common-tier pockets, which have no equivalently-live-tested precedent.
- **Solo heavy anchor, unarmored L1, normal hits only:** 4 raw dmg / 900ms ≈ 4.4 dps → 45 HP lasts ~10.1 seconds; 55 HP lasts ~12.4 seconds. Anchor has 34 HP, takes ~7 player hits (~7 seconds) to kill — a genuinely close, "real" fight, which is the intent of this build. **This is no longer the worst case** — the 3-enemy pocket pull above is faster and more dangerous for an unarmored character.
- **Geared character (armor 1+):** every 2-damage common hit floors to 1 HP, cutting the worst 3-enemy pocket's combined DPS to 3.33 (TTK ~13.5s) — armor neutralizes this risk almost immediately, consistent with 0.11's mitigation-floor finding. This risk is specifically, and only, sharp for a **fully unarmored** character — the same population Question 4 already worries about.
- Both the pocket-pull and solo-anchor cases assume total passivity (the player does nothing back and never repositions) — a worst-case upper bound, not the expected experience. A player is expected to be actively fighting back (own damage ~5-6/attack) and can retreat out of aggro range to drop targeting entirely (Question 3's leash/return logic). The open question is whether that reaction is realistically available: the normal-attack windup is a fixed **300ms** (`ENEMY_ATTACK_WINDUP_MS`, both rooms) regardless of solo or swarm — short at the best of times, and this build is literally the first time any player will ever have seen a telegraph do anything, so there is no learned caution to rely on for a first encounter.

**Revised verdict: cutting heavy attacks (Question 1) bounded the *per-hit* ceiling at 4 raw damage, but did not bound *sustained multi-attacker* exposure, which is the sharper number.** The real worst case 0.24 can produce is an unarmored character pulling a full 3-enemy common-tier pocket in one of the three newer zones, going down in as little as ~6.75 seconds if fully passive. No enemy content values are proposed to change as part of this build; if the live check nonetheless finds something that reads as broken, that's a finding to bring back for a scoping decision, not something to silently patch by editing content numbers mid-build. See Question 4 for whether this changes the zone-gating call, and Risks for the concrete, pre-committed live-check criterion and fallback.

---

## Question 3 — Interaction with Dodge, Flask, and Death-to-Nightmarket

All three systems were built "for" a retaliation system that didn't yet exist. Each needs to be confirmed, not assumed, once it does.

**Dodge** (0.12, `applyDodgeIntent.ts`, ported into `CombatRoom.ts` at [lines 843-929](apps/server/src/realtime/rooms/CombatRoom.ts#L843-L929)): dodge is a pure positional snap; it has **no explicit dodge-chance or invulnerability flag** anywhere in the mitigation path. It only avoids damage indirectly — if it moves the player outside `ENEMY_ATTACK_RANGE` before an in-flight telegraph lands, the landing code's own range re-check naturally resolves it as a miss (this is exactly how `TownRoom.ts:3500` already works, and the ported `CombatRoom.ts` landing check at `1580-1584` already has the identical shape). Once real telegraphs exist in CombatRoom, this should work with **no code change** to dodge itself — but it has never been proven end-to-end anywhere in the codebase: a full search found no existing test (TownRoom or CombatRoom) that actually times a dodge against a live telegraph and asserts a miss. This build should add that test — it's a first for both rooms, not just CombatRoom.

**Flask** (0.12, `applyHealingFlaskIntent.ts`, ported at [lines 948-1021](apps/server/src/realtime/rooms/CombatRoom.ts#L948-L1021)): heals a flat 25 HP, fully independent of enemy state — it only reads/writes the player's own hp/charges/cooldown. It already works correctly today; it simply has nothing meaningful to heal from yet. No changes needed; add one integration test proving flask heals correctly *after* taking real retaliation damage (closing the loop, not just re-proving the flask math in isolation).

**Death-to-Nightmarket** (0.14, `registerRespawnHandler` in `CombatRoom.ts`, [lines 1270-1359](apps/server/src/realtime/rooms/CombatRoom.ts#L1270-L1359)): this logic is triggered purely by `player.lifeState !== "alive"` on a `request_respawn` — it does not care *how* the player got downed. It should work unchanged. However: the only existing test for it, `deathReturnsToTown.test.ts`, manually pokes `player.hp = 0; player.lifeState = "downed"` rather than being driven by a real enemy hit — confirming this path has **never been exercised end-to-end through real combat**, in a test or (since retaliation never worked) in real play either. This build should add a new test that lets an actual enemy attack bring a player's HP to 0 through the real landing code path, then confirms the same `combat_town_return_approved` handoff fires — this is the first genuine end-to-end proof that dying in a combat zone works as designed.

**Net finding:** none of the three systems need code changes. All three need a genuine end-to-end test they've never had, because none of them have ever had a real retaliation path to interact with before.

---

## Question 4 — Zone-Gating: An Explicit Decision

The gap is real and, for the first time, has real teeth: this is the first build where CombatRoom enemies deal any damage at all, so "no zone has a level/gear requirement" stops being a theoretical gap and starts being a live one. Two options were weighed.

**Option A — a soft level/gear-check warning on zone entry.** Rejected for this build. Implementing a genuine (non-fake) version requires two things neither of which exists today and neither of which is a wiring fix: (1) an authored notion of zone difficulty to warn against — `ZoneContentDefinition` has no recommended-level/tier field at all, and the raw numbers don't actually support inventing one cheaply: all four zones' rosters are close in HP/damage (30-34 HP anchors, 3-4 normal damage, 1-2 common-tier damage across the board), so there is no real difficulty curve across zones today to warn a player about — asserting one would mean designing that curve first, a genuine content/balance decision, not a fact this build can read off existing data; (2) new client UI and a protocol addition to surface the warning, which is out of this build's server-only footprint. A warning built without real difficulty data behind it would be cosmetic — exactly the "fake feature" shape this project's own AGENTS.md Core Rule forbids, and the same shape 0.10/0.11 each fixed once already.

**Option B — accept the gap as-is for 0.24, queue a real fix immediately after. Chosen, on revised grounds.** This matches the project's own established precedent exactly: 0.11 named and explicitly deferred the death/respawn-consequences gap rather than inventing a shallow version of it mid-build, reasoning that it was open-ended design work with no existing formula to lean on — the zone-gating gap is the same shape (it needs an authored difficulty model and new UI, not a stat wired through an existing formula).

**Revision (post-review): the original justification here — "the worst case is bounded at a single 4-damage hit" — was wrong.** The real worst case, walked through in Question 2, is a full 3-enemy common-tier pocket pull, which can kill an unarmored character *faster* than the solo heavy anchor (~6.75s vs ~10s). That number does not, on its own, make zone-gating a good fix, for a reason distinct from the original (now-corrected) claim: **the swarm-pull risk is not a level/gear-mismatch problem, so a level/gear gate on a zone would not address it.** A well-geared level-10 character can walk into the exact same 3-enemy pocket and make the exact same positioning mistake; gating access by level or gear changes nothing about pocket density or aggro-radius overlap. It is also not new in kind — Blackwire Sewers and Nightmarket already ship multi-enemy pockets today (2-enemy runt pockets, somewhat lower combined DPS) without this being flagged as broken; the three newer zones' 3-enemy pockets are a sharper version of an already-shipped, already-accepted risk shape, not a new category of danger a gate would meaningfully gate. Zone-gating therefore stays declined for 0.24 — but for the corrected reason, not the original one.

**Concretely:** zone-level/gear gating (whatever shape it takes — a soft warning, a hard requirement, or an authored per-zone difficulty rating) is named here as a queued follow-up, most naturally scheduled once the heavy-attack follow-up above also ships (at that point the top-end lethality numbers are back in play and a real gating conversation matters more). The swarm-pull risk itself is handled separately — see Risks below for the live-check criterion and pre-committed fallback (a simultaneous-attacker cap), which is the more honest fix for *that* specific risk if it turns out to need one, since gating wouldn't have touched it anyway.

---

## Proposed Implementation Approach (for review, not yet executed)

Port `TownRoom.applyEnemyAggroDamage`'s acquisition/leash/telegraph/landing logic into `CombatRoom.ts`, replacing `applyCombatEnemyAggroDamage`'s current body, reusing the already-shared pure helpers (`moveEnemyTowardTarget`, `moveEnemyTowardPoint`, `clearEnemyTargetAndReturn`, `resetEnemyCombatState`, `mitigateIncomingDamage`) rather than re-implementing them. This mirrors exactly how 0.12 ported the dodge and flask handlers — as direct, room-local copies of proven logic, not a new shared-module extraction. **Per Question 1, the heavy-attack branch is intentionally not ported this build** — the landing call always resolves as a normal hit (`attackKind` stays `"normal"`, `heavyAttackDamage`/`heavyAttackChance`/etc. stay unread), the same normal-only shape CombatRoom's damage line already has today; only the acquisition/leash/telegraph machinery around it is new.

This does mean CombatRoom and TownRoom will each carry their own ~300-line copy of the acquisition/telegraph/landing block, which is a real duplication cost — CombatRoom's version today is much shorter precisely because it skipped this logic. Extracting a genuinely shared helper (the "deferred... task" CombatRoom's own comment gestures at, but which was never created) is a reasonable alternative, and would close the duplication gap for good. Recommendation is to **duplicate, not extract**, for this build: extraction is a larger refactor with its own risk (any subtle behavioral difference between the two rooms' current usage would need reconciling), it's not this build's stated job, and it matches the project's own established precedent (0.12's dodge/flask). Flagging the extraction as a reasonable fast-follow rather than doing it silently or skipping the tradeoff discussion entirely.

Send-side wiring (`sendEnemyAttackTelegraph`, `sendEnemyAttackResolved`, `DamageAppliedServerMessage`) already exists in both rooms with matching shapes — no protocol changes expected.

---

## Verification Strategy

Per `AGENTS.md`'s "Verification Must Be Permanent" rule, plus a live check — this build is the first to make real damage-taken and death observable in a browser at all, so a Playwright pass is worth doing for real, not skipped as "probably fine like every prior pure-server build."

**New/updated vitest coverage** (`apps/server/test/combat/`):

- Enemy acquisition + telegraph + landing, proving an idle enemy in Blackwire Sewers acquires the nearest player, telegraphs, and lands a mitigated normal hit — the core regression this build exists to add.
- A test against one of the newer zones' heavy anchors (e.g. Saltmere Docks' Drowned Hauler) confirming it only ever lands its **normal** damage in CombatRoom this build — a regression guard for the Question 1 cut, so a future change can't silently reintroduce the heavy branch without a matching test update. (The heavy-attack-specific test itself — proving the heavy branch lands and is mitigated — is queued with the follow-up build, not written here.)
- A leash/return test (enemy disengages beyond leash range, returns to spawn, re-idles) — parity check against TownRoom's existing behavior.
- A dodge-causes-a-miss test: time a `request_dodge` against a live telegraph so the landing range-check resolves to a miss — new coverage, first of its kind for either room.
- A flask-after-real-damage test: take a real retaliation hit, then heal via flask, confirm HP restoration.
- An upgrade to (or sibling of) `deathReturnsToTown.test.ts` that lets a real enemy attack bring HP to 0, then confirms the Nightmarket handoff still fires — replacing the current manual-HP-poke as the primary proof for at least one case.
- Re-run the full existing suite (all `apps/server/test/combat/*` and `apps/server/test/town/*`) as the regression baseline this build must not break, including the existing `dodgeIntent.test.ts` and `healingFlaskIntent.test.ts`, which currently pass with nothing to interact with.

**Live Playwright check** (first time this is observable in a real browser): join a combat zone, let an enemy engage, watch the HP bar (already shipped in 0.23) drop from a real telegraphed hit, observe a telegraph fire, attempt a dodge against one, use a flask mid-fight, and — if reachable within a reasonable session — let a character actually die and watch the real Nightmarket handoff play out. Two scenarios are load-bearing, not optional extras: the solo heavy-anchor fight, and — the sharper one, per the revised Question 2 — **standing centrally in a full 3-enemy common-tier pocket (Static Yard's wretch-north or Cinderworks' hound-north) on a fresh, unarmored character**, to empirically confirm a real player has a fair chance to notice and disengage before going down, not just that the math bounds it on paper. See Risks for the specific pass/fail criterion and fallback.

**Gates:**
- `pnpm -r typecheck` clean.
- `pnpm --filter @doomscrolls/server test` green, including all new tests.
- No commits unless the working tree is already clean going in (standing rule).

---

## Core 0.24 Non-Goals

```text
heavy attacks (Arc Sentinel/Foundry Warden/Drowned Hauler/Trashboar Brute's heavyAttackDamage branch) -- cut for sequencing reasons per Question 1, queued as an immediate follow-up build, not indefinitely deferred
new enemy types, new AI states, ranged or pack-coordination enemy behavior
threat tables, aggro transfer between players on damage dealt, taunt mechanics
zone-level gating / a difficulty curve enforced by the game itself -- explicitly decided (accept as-is for 0.24, queue a real follow-up), not left as an open risk -- see Question 4
rebalancing enemy damage/HP/heavyAttackDamage content values, or the mitigation formula itself -- this build wires existing, already-authored numbers into a path that currently never runs them; if the balance walkthrough or live check surfaces something that reads as broken, that comes back as a scoping question, not a silent content edit mid-build
extracting a shared enemy-AI helper module for the ported block -- named as a reasonable fast-follow, not done here (see Proposed Implementation Approach)
corpse recovery / item-drop-on-death, respawn timers, or any other death-cost changes beyond the already-shipped 0.14 location penalty
PvP
new zones, classes, skills, items
```

---

## Candidate Task Waves

### Wave 1 — Planning (this document)
- This plan + `docs/CORE_BUILD_0_24_CHECKLIST.md`
- Explicit stop for review before any code change

### Wave 2 — Core Port
- Port `TownRoom.applyEnemyAggroDamage`'s acquisition/leash/telegraph/landing logic into `CombatRoom.ts`, reusing existing shared pure helpers and `mitigateIncomingDamage`
- Heavy-attack fields (`attackKind`, `nextHeavyAttackAtMs`, and the four `heavyAttack*` content fields) are deliberately **not** read this wave — `attackKind` stays `"normal"` — per Question 1's cut

### Wave 3 — Verification
- New/updated vitest coverage per the Verification Strategy above, across all 4 zones (at minimum: acquisition+landing, heavy-anchor-lands-normal-only regression guard, leash/return, dodge-causes-miss, flask-after-damage, real-death-to-Nightmarket)
- Regression run of the full existing suite
- `pnpm -r typecheck`

### Wave 4 — Live Check and Docs
- Playwright pass per the Verification Strategy above, including both the solo-heavy-anchor fight and the 3-enemy common-tier pocket-pull scenario (Question 2's revised worst case)
- If the pocket-pull scenario fails the Risks-section criterion (player has no realistic chance to notice/disengage), fold in a bounded simultaneous-attacker cap before shipping, per the pre-committed fallback — this loops back into Wave 2's port, not a separate build
- `docs/CORE_BUILD_0_24_RELEASE_NOTES.md`, naming both queued follow-ups (heavy attack parity; zone-level/gear gating) explicitly as the next builds, not a vague "later"

---

## Queued Follow-Up Builds (named explicitly, not left as vague backlog items)

1. **CombatRoom Heavy Attack Parity** — port the heavy-attack branch (Question 1's cut) once 0.24 is live-verified. Scope: read the four `heavyAttack*` content fields and the eligibility/chance-roll logic from `TownRoom.ts:3362-3376`/`3594-3620`; its own live check should isolate the never-before-fired 7-damage hit.
2. **Zone-Level/Gear Gating** — resolve the Question 4 gap for real (an authored per-zone difficulty model plus, most likely, client-facing UI), most sensibly scheduled once follow-up 1 restores the higher-lethality heavy-hit numbers to the table.

---

## Risks

1. **Cutting heavy attacks means this build ships an intentionally incomplete parity with TownRoom** — three of four zones' heavy anchors will still only ever land their normal hit in CombatRoom while landing both in Nightmarket/TownRoom, a real (if temporary and named) asymmetry between the two rooms until the queued follow-up ships. Accepted because it's the whole point of the sequencing decision in Question 1: isolate the untested base mechanism before layering a second untested one on top.
2. **The zone-gating gap is now an explicit, accepted decision (Question 4), not an open risk to watch** — accepted because the swarm-pull risk (Risk 7, below) is orthogonal to level/gear and already exists in shipped content at a lesser degree, not because heavy attacks are cut. If the heavy-attack follow-up ships before a real gating mechanism does, this decision should be revisited rather than assumed to still hold at the higher lethality ceiling.
3. **Full TownRoom parity on everything except heavy attacks (Question 1) is still a substantial port**, not a minimal patch — a partial port of even the normal-hit path (e.g., skipping leash/return) would strand schema fields as dead code a second time, so the acquisition/leash/telegraph/landing machinery is ported in full; only the heavy-attack layer on top of it is deferred.
4. **Duplication, not extraction** (Proposed Implementation Approach) means CombatRoom and TownRoom now each carry a full independent copy of the acquisition/telegraph/landing block — any future bugfix to one must remember to check the other. This mirrors existing dodge/flask duplication from 0.12 and is treated as an accepted, named tradeoff, not silently introduced.
5. **This is the first time CombatRoom damage-taken and death are observable in a real browser session** — higher chance of surfacing a UI-side surprise (HP bar, telegraph visuals, death/respawn handoff) that a pure server-side vitest pass wouldn't catch, which is exactly why a live Playwright check is planned rather than skipped.
6. **Dodge's "avoidance" is entirely an emergent property of range-checking at landing time, not an explicit chance/invulnerability system** — this is inherited, unchanged behavior from TownRoom, not something this build is introducing or fixing, but it means "dodge" only helps against attacks that are already telegraphed and only if timed to exit range before landing; it does nothing against an attack that hasn't started windup yet. Worth confirming this reads correctly in the live check rather than assuming the existing TownRoom shape is automatically the right feel for CombatRoom too.
7. **The real worst-case exposure in 0.24 is a full 3-enemy common-tier pocket pull on an unarmored character (~6.67 combined raw DPS, ~6.75s time-to-kill), not the single 4-damage hit originally used to bound Question 4's decision** — confirmed by direct calculation against `spawnZones.ts`'s actual pocket layout (Question 2). This is faster and more dangerous than the solo heavy-anchor fight. It is judged acceptable to ship without a new mitigation for three specific reasons: (a) it isn't a level/gear-mismatch problem, so zone-gating wouldn't fix it anyway (Question 4); (b) the same risk shape — multiple weak enemies in one pocket — already exists in shipped content (Blackwire Sewers' and Nightmarket's 2-enemy runt pockets) without prior complaint, just at a lower per-pocket count; (c) a bespoke simultaneous-attacker cap would be new AI behavior neither TownRoom nor the original CombatRoom parity has, cutting against "port, don't invent," on the basis of worst-case arithmetic alone rather than an observed live problem. **Pre-committed live-check criterion:** during Wave 4, deliberately pull a full 3-enemy pocket (e.g. Static Yard's wretch-north) on a fresh, unarmored test character and confirm a player who reacts at a normal, first-encounter pace (no advance knowledge that retaliation works, since this is the first build where it does) has a realistic chance to notice, disengage, or fight back before going down — not simply that the arithmetic permits it. **Fallback if it fails:** add a small, bounded cap on how many enemies may simultaneously hold an active target lock on one player (e.g. 2) directly into this build's Wave 2 port, not deferred to a follow-up — this is the smaller, more contained fix compared to reopening zone-gating, since it touches only the acquisition loop already being written, requires no new content data or client UI, and directly addresses the mechanism causing the risk rather than gating around it.

---

## Summary

CombatRoom's enemy retaliation has been non-functional since it was first stubbed in as "minimal... deferred" — no code path in any of the four combat zones ever assigns a real player as an enemy's target, so players have taken zero risk fighting there since these zones shipped. TownRoom already has a complete, correct version of this logic (`applyEnemyAggroDamage`), and the runtime schema CombatRoom already uses (`EnemyPresence`) already carries every field that logic needs, including the heavy-attack fields CombatRoom's own initializer already resets on every spawn. This build's job is to port that logic, not invent new combat AI — the same shape as every prior TownRoom-only-gap fix.

Three changes were made after review, in two rounds. First, heavy attacks are deliberately cut from this build's scope (Question 1) and queued as an immediate follow-up: landing two never-tested mechanisms (basic retaliation and heavy attacks) in the same live check would make any bad result ambiguous as to cause, so the base acquisition/leash/telegraph/landing loop ships and gets live-verified on its own first. Second, the zone-gating gap (no combat zone has any level/gear requirement) is resolved as an explicit decision rather than an open risk: accepted as-is for 0.24, with a real fix (an authored difficulty model, likely paired with client UI — not a cosmetic warning with no data behind it) queued as its own follow-up.

Third, on a further check: the single-hit ceiling used to justify the zone-gating decision (4 raw damage, after cutting heavy attacks) turned out not to be the real worst case. Multi-enemy aggro was staying in scope, and walking it through against the actual pocket layout in `spawnZones.ts` found a sharper number — a full 3-enemy common-tier pocket pull can kill an unarmored character in ~6.75 seconds, faster than the solo heavy-anchor fight. This doesn't reopen the zone-gating decision (the swarm risk isn't a level/gear-mismatch problem, and it isn't new in kind — Blackwire Sewers and Nightmarket already ship smaller versions of the same risk shape), but it does mean 0.24 carries a real, load-bearing live-check obligation: confirm a first-time player can realistically notice and react to a full pocket pull, with a pre-committed, bounded fallback (a simultaneous-attacker cap folded into this build's own port) if that check fails, rather than shipping on the strength of worst-case arithmetic alone.

Dodge, flask, and the 0.14 death-to-Nightmarket handoff should all work unchanged once retaliation is real, but none of the three have ever been proven against a real attack — closing that gap is this build's verification job as much as the port itself.
