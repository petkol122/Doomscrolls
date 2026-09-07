# docs/CORE_BUILD_0_24_CHECKLIST.md — Core Build 0.24 Checklist

---

## Core 0.24 Planning Open Checklist

**Date:** 2026-09-04
**Build:** Core Build 0.24
**Theme:** CombatRoom Enemy Retaliation — Closing the "Deferred" Gap
**Status:** Implemented and verified. Plan approved, Waves 2-4 completed in this session, including one mid-implementation scope addition (a CombatRoom-only dodge/windup fix, explicitly approved by the user when discovered) beyond what the approved plan specified. See `docs/CORE_BUILD_0_24_RELEASE_NOTES.md` for full detail.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_24_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_24_CHECKLIST.md`
- [x] Confirm the gap directly against source: every `targetPlayerSessionId` assignment site in `CombatRoom.ts` audited, none ever assigns a real session id
- [x] Confirm CombatRoom deals zero player damage today, by any path (full search for other `hp` write sites)
- [x] Read `TownRoom.applyEnemyAggroDamage` in full and map its acquisition/leash/telegraph/landing/heavy-attack structure
- [x] Confirm `mitigateIncomingDamage`'s exact formula and its two call sites
- [x] Confirm the shared `EnemyPresence` schema already carries every field the port needs (`spawnX`/`spawnY`, `attackKind`, `nextHeavyAttackAtMs`) and that `initializeCombatEnemies.ts` already resets them correctly
- [x] Answer Question 1 (heavy attacks / multi-enemy aggro scope) with an explicit case for and against, not a default
- [x] **Revision:** re-scope Question 1 to cut heavy attacks from 0.24 entirely, queued as an immediate named follow-up build — reasoning: two never-tested mechanisms (basic retaliation + heavy attacks) landing together makes a bad live-check result ambiguous as to cause; multi-enemy aggro stays in scope since it's not a second mechanism, just the same acquisition loop applied per-enemy
- [x] Do the balance arithmetic walkthrough before implementation: player HP/armor/damage by level and gear tier, enemy roster per zone, mitigation-floor table, worst-case TTK scenarios for all 4 zones
- [x] **Revision:** recompute the balance walkthrough for normal-hit-only scope (0.24's hardest possible hit is now 4 raw damage, not 6-7) now that heavy attacks are cut
- [x] Confirm no zone-level gating exists anywhere (a fresh L1 character can reach any zone immediately) and factor that into the balance verdict
- [x] **Revision:** turn the zone-gating gap into an explicit decision (Question 4) rather than a flagged-but-open risk — weighed a soft level/gear warning on entry (rejected: needs an authored difficulty model that doesn't exist plus new client UI, the same open-ended-design shape this project has repeatedly declined mid-build) against accept-as-is-and-queue-a-follow-up (chosen, and made safe specifically because heavy attacks are cut per the Question 1 revision)
- [x] Confirm dodge's actual avoidance mechanism (range re-check at landing, not an explicit chance flag) and that no test anywhere proves it causes a miss
- [x] Confirm flask is already correctly ported and independent of enemy state
- [x] Confirm the 0.14 death-to-Nightmarket handler is decoupled from *how* HP hit zero, and that its only existing test drives death by manually poking `hp`/`lifeState` rather than through a real hit
- [x] Decide port-and-duplicate vs. extract-a-shared-helper, with the tradeoff named explicitly
- [x] Define candidate task waves
- [x] Define explicit 0.24 non-goals
- [x] Define the 0.24 risk list
- [x] Define the verification strategy, including the first-ever live Playwright check of CombatRoom damage/death
- [x] Name both queued follow-up builds explicitly (Heavy Attack Parity; Zone-Level/Gear Gating), not as vague "later" items
- [x] **Second revision:** verify whether Question 2's balance walkthrough actually accounted for multi-enemy aggro (staying in scope per Question 1) as its own scenario, not folded loosely into the single-enemy numbers — it hadn't been done properly
- [x] Compute the real worst case against exact `spawnZones.ts` pocket counts/stats: a full 3-enemy common-tier pocket pull (Static Yard wretch-north or Cinderworks hound-north, 6.67 combined raw DPS) kills an unarmored L1 in ~6.75s — faster than the solo heavy-anchor case (~10s) the plan had been treating as the worst case
- [x] Re-examine whether this new number undermines Question 4's zone-gating decision — concluded it doesn't reopen the decision (the swarm risk isn't a level/gear-mismatch problem, and a smaller/lesser version already exists unflagged in shipped content), but the *stated justification* for the decision needed correcting since it had relied on the wrong (single-hit) bound
- [x] Weigh a simultaneous-attacker cap against reopening zone-gating for this specific risk, chose neither by default — added a concrete, falsifiable live-check criterion for Wave 4 with the cap pre-committed as the fallback only if that check fails, rather than either inventing a new mechanic on worst-case arithmetic alone or reopening a design question (zone gating) that doesn't actually address this risk category
- [x] Get revised plan reviewed/approved before starting Wave 2

### Core 0.24 Scope Guardrails (for implementation, once approved)

- [x] No enemy damage/HP/`heavyAttackDamage` content values or the `mitigateIncomingDamage` formula are changed anywhere in this build — wiring only
- [x] Heavy attacks are **not** ported this build — `attackKind` stays hardcoded `"normal"`, all four `heavyAttack*` content fields and `nextHeavyAttackAtMs` stay unread in `CombatRoom.ts`, exactly as today (confirmed live: `heavyAnchorNormalOnlyGuard.test.ts` + live Drowned Hauler observation, both consistent with normal-only)
- [x] No new enemy types, AI states, ranged/pack behavior, threat tables, or aggro-transfer mechanics
- [x] No zone-level gating is added — explicitly accepted as-is for this build (Question 4), not silently left open, with a real follow-up named
- [x] `applyDodgeIntent`/`applyHealingFlaskIntent`/`dodgeCooldown`/`healingFlaskConfig` are not modified — only exercised against real retaliation for the first time
- [x] `TownRoom.ts`'s existing `applyEnemyAggroDamage` is not changed at all
- [x] The ported CombatRoom logic reuses the existing shared pure helpers (`moveEnemyTowardTarget`, `moveEnemyTowardPoint`, `clearEnemyTargetAndReturn`, `resetEnemyCombatState`) rather than re-implementing them
- [x] No shared-helper-module extraction is attempted in this build (logged as a fast-follow candidate, not silently done or silently skipped)
- [x] Every new behavior lands as a vitest case in `apps/server/test/combat/`, not a throwaway scripted client
- [x] A live Playwright check is performed and its outcome is reported, not assumed — covering the solo heavy-anchor fight and the 3-enemy common-tier pocket-pull scenario (Saltmere Docks' `crawler_pocket_north` substituted for Cinderworks/Static Yard — see release notes "Environment notes" for why — same risk category, 6.00 vs 6.67 combined DPS), against the explicit reaction-fairness criterion in Risk 7
- [x] Pocket-pull criterion **passed** live (clear, repeated, unmissable feedback well before a dangerous HP threshold) — the pre-committed simultaneous-attacker cap was **not** needed and was **not** added
- [x] **Not in the original guardrail list, added mid-implementation with explicit user approval:** a CombatRoom-only fix (enemies freeze movement during an active telegraph) was made after discovering TownRoom's identical, shared aggro logic made "dodge causes a miss" structurally unreachable for a single dodge — see release notes "A finding during implementation." This is a real, named CombatRoom/TownRoom divergence, not a silent scope change.

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.24 scope documents
- [x] Reconfirm the current full server test suite as the regression baseline 0.24 must not break

#### Wave 2 — Core Port (priority)

- [x] Port `TownRoom.applyEnemyAggroDamage`'s acquisition/leash-return/telegraph/landing state machine into `CombatRoom.ts`, replacing `applyCombatEnemyAggroDamage`'s body
- [x] Do **not** read `heavyAttackWindupMs`/`heavyAttackDamage`/`heavyAttackCooldownMs`/`heavyAttackChance`/`nextHeavyAttackAtMs` — `attackKind` stays hardcoded `"normal"` for every enemy, including the three heavy anchors and Trashboar Brute (Question 1 cut)
- [x] Confirm proximity-based acquisition scans all connected players per enemy (multi-enemy aggro falls out of this for free, not built separately, and stays in scope)
- [x] Confirm leash/return-to-spawn behavior matches TownRoom's
- [x] **Added mid-implementation:** freeze enemy movement while a telegraph is in flight (CombatRoom-only divergence from TownRoom) — see release notes

#### Wave 3 — Verification (priority)

- [x] `test/combat/enemyAggroAcquisition.test.ts`: enemy acquisition + telegraph + landing in Blackwire Sewers, proving a real mitigated normal hit lands
- [x] `test/combat/heavyAnchorNormalOnlyGuard.test.ts`: regression guard proving Saltmere Docks' Drowned Hauler only ever lands its normal damage in CombatRoom this build — confirms the Question 1 cut, not the heavy branch itself (that test is queued with the follow-up build)
- [x] `test/combat/enemyLeashReturn.test.ts`: leash/return-to-spawn parity test
- [x] `test/combat/dodgeAvoidsRetaliation.test.ts`: dodge-causes-a-miss test (new coverage — first of its kind for either room; passes because of the mid-implementation windup-freeze fix)
- [x] `test/combat/flaskAfterRetaliationDamage.test.ts`: flask-heals-after-real-retaliation-damage test
- [x] Added `test/combat/realRetaliationDeathReturnsToTown.test.ts` as a sibling to `deathReturnsToTown.test.ts` (kept as-is) so death is driven by a real enemy hit, not only a manual `hp = 0` poke
- [x] Regression-check discipline: temporarily reverted the port (`git stash`), confirmed 4 of 6 new tests fail as expected (the 2 that use the established preset-target shortcut passed either way, correctly, since they test landing math not acquisition), restored, re-verified green
- [x] Full existing suite (`apps/server/test/combat/*`, `apps/server/test/town/*`) stays green — 33 files / 52 tests
- [x] `pnpm -r typecheck` clean
- [x] Also fixed as a consequence: `test/combat/incomingDamageMitigation.test.ts` (0.11) needed its enemy co-located with its own real `spawnX`/`spawnY` now that leash logic is real

#### Wave 4 — Live Check and Docs

- [x] Playwright: joined Blackwire Sewers, observed a real telegraph and a real HP-bar drop from an enemy hit (`"Enemy attack hits for 2."`, matching `trashboar_runt`'s content damage exactly)
- [x] Playwright: attempted a dodge against a live telegraph, confirmed a miss (`"Enemy attack missed."` + correctly-rejected immediate re-dodge on cooldown)
- [x] Playwright: used a flask mid-fight, confirmed HP restoration (partial rise observed live due to concurrent ongoing damage; full amount confirmed deterministically by the unit test)
- [x] Playwright: fought Saltmere Docks' Drowned Hauler and confirmed only normal hits observed (no 7-damage hit ever seen; all damage deltas decomposed into the zone's only two damage values, 2 and 4)
- [x] Playwright: on a fresh, unarmored character, stood centrally in a full 3-enemy pocket. First pass used Saltmere Docks' `crawler_pocket_north` (6.00 theoretical DPS) as a substitute after gate-click navigation to Cinderworks/Static Yard proved unreliable — that pass observed only ~3.33 dps (~50-56% of theoretical), a materially weaker result than Q2's 6.67-DPS worst case, caught on review as not actually confirming the named pockets
- [x] **Re-run against the real worst-case pocket**: Static Yard's `wretch_pocket_north` (3× Static Wretch, the actual 6.67-DPS pocket Q2 identified), reached via a direct database write (`currentZoneId`/`lastLocationX`/`Y`/`currentHp` on the `Character` row) placing a fresh, unarmored character exactly at the pocket center — no gate-click navigation. Real observed result: ~4.35-4.84 dps (65-73% of theoretical), ~9.3s real TTK, in spiky near-synchronized −6 volleys every ~1.2-1.3s, with three simultaneous "INCOMING" telegraphs visually confirmed (screenshotted)
- [x] Criterion **still passes on the real pocket**, by a real but smaller margin than the substituted pocket suggested (loud triple-telegraph warning; a player reacting within 3 volleys, ~3.75-5s, retains 47-60% HP) — the pre-committed simultaneous-attacker-cap fallback was **not** implemented
- [x] Playwright: death observed live (HP reached 0 under real multi-enemy pressure, both at Static Yard's wretch-north and in an earlier Saltmere Docks pass); the real-hit-to-Nightmarket path is the same one `realRetaliationDeathReturnsToTown.test.ts` proves deterministically
- [x] Wrote `docs/CORE_BUILD_0_24_RELEASE_NOTES.md`, naming both queued follow-ups (Heavy Attack Parity; Zone-Level/Gear Gating) explicitly as the next builds, plus a third minor follow-up (TownRoom's own dodge-vs-chase gap, discovered but not fixed there)
- [x] Full `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test` pass
- [x] No commit made — working tree was clean before this session's work began; committing was not requested

### Explicit Non-Goals / Deferred Items

- [x] Heavy attacks (queued as an immediate named follow-up build, "CombatRoom Heavy Attack Parity" — not indefinitely deferred)
- [x] No content-value rebalancing (enemy damage/HP/heavy values, armor items, or the mitigation formula) — none needed; the live check passed
- [x] Zone-level gating / difficulty curve (explicit accept-as-is decision, queued as an immediate named follow-up build, "Zone-Level/Gear Gating" — not left as an open risk)
- [x] No threat tables, aggro transfer, taunt, ranged/pack enemy behavior
- [x] No shared-helper-module extraction (fast-follow candidate only)
- [x] No corpse recovery, item-drop-on-death, or respawn-timer changes beyond the already-shipped 0.14 location penalty
- [x] No PvP, new zones, classes, skills, or items

### Planning Exit Criteria

- [x] Core Build 0.24 has a clear theme grounded in a direct audit of `CombatRoom.ts` against `TownRoom.ts`
- [x] The heavy-attack/multi-enemy-aggro scope question was answered with an explicit case for and against, not defaulted, and revised to cut heavy attacks with an explicit sequencing reason (not a silent scope reduction)
- [x] A full numeric balance walkthrough was done before implementation, against real current content values, recomputed for the narrowed (normal-hit-only) scope, and further corrected once multi-enemy aggro's real worst case was walked through against actual pocket layout (not left as a loose estimate)
- [x] The zone-gating gap has a real, argued decision (accept-as-is + queued follow-up), not just a flagged risk — and that decision's justification was re-examined and corrected once a sharper worst-case number surfaced, rather than left standing on an outdated basis
- [x] Dodge, flask, and death-to-Nightmarket were each individually confirmed for how they will (or won't) need to change, not assumed to "just work"
- [x] Core Build 0.24 has grouped candidate waves
- [x] Core Build 0.24 has explicit non-goals, including both newly-cut items (heavy attacks, zone gating) named as immediate queued follow-ups rather than vague deferrals
- [x] Core Build 0.24 has an explicit risk list, updated for the narrowed scope
- [x] Core Build 0.24 has a verification strategy that includes a live Playwright pass, named explicitly as a first for this system
- [x] Revised plan reviewed and approved by the user
- [x] Implementation completed: Waves 2-4 done, all vitest coverage green, live Playwright check passed, release notes written
