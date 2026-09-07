# docs/CORE_BUILD_0_28_PLAN.md — Core Build 0.28 Plan

## Status

**Implemented and verified.** Confirmed to be almost entirely a port, as expected: zero client code changes were needed (the rendering path is already shared between TownRoom and CombatRoom). Server-side coverage added for the two things that had never actually been proven with two real players, plus a live two-context Playwright check in a real combat zone. See Outcome at the bottom.

## Theme

**CombatRoom Player Visibility** — the follow-up named in `docs/CORE_BUILD_0_27_PLAN.md`, extending 0.27's TownRoom other-player rendering to combat zones. Mostly reuse, not redesign, per the same "TownRoom already has it, CombatRoom doesn't" shape as skill slots (0.9) and dodge/flask (0.12/0.24).

## Build framing — the headline finding

`worldSessionAreaView.ts` (client) is **one shared view used for both TownRoom and CombatRoom** — `WorldSessionScene.ts` calls the same `createWorldSessionAreaView` regardless of `roomKind`, and nothing inside it branches on room kind for presence rendering. `getTownRoomPresence()` (despite its name) reads `state.playerPresence` structurally, with no room-kind check, and `CombatRoomState` declares the identical `@type({ map: PlayerPresence }) playerPresence` field as `TownRoomState`. **0.27's `otherPlayerPlaceholders` rendering code already runs, unmodified, whenever a client is in a CombatRoom** — there is no separate CombatRoom view to port into. This build's client-side work is therefore verifying and locking that in with a real test, not writing new rendering code, unless one of the three wrinkles below calls for a deliberate divergence.

## Wrinkle 1 — Aggro/targeting with two real players

`CombatRoom.applyCombatEnemyAggroDamage` was ported from `TownRoom.applyEnemyAggroDamage` in 0.24 as a direct, unmodified copy of the proximity-scan-all-connected-players loop (`state.playerPresence.forEach` to find the nearest alive player per enemy — [CombatRoom.ts:~1602-1613](apps/server/src/realtime/rooms/CombatRoom.ts)). 0.24's own doc comment states multi-enemy aggro (each enemy independently targeting the nearest of *all* connected players) was explicitly in scope and "falls out of the ported acquisition loop directly." `request_attack` ([CombatRoom.ts:734](apps/server/src/realtime/rooms/CombatRoom.ts#L734)) has no "already being attacked by someone else" gate — each attack is validated and applied per-client, with XP/loot/objective-progress granted to that client only, independent of any other player's actions against the same enemy.

**Conclusion: already correctly handles multiple real players by construction — but never actually tested or live-verified with two real players present.** Every existing CombatRoom test (`enemyAggroAcquisition.test.ts`, `zoneMatchmaking.test.ts`, etc.) uses at most one real client per room, or multiple clients in *different* rooms. No logic change is needed; this build adds the missing test coverage (see Verification) rather than fixing a bug, and the live check specifically watches for anything that reads as wrong under real simultaneous combat.

## Wrinkle 2 — Does the six-field whitelist still fit?

0.27 whitelisted exactly `displayName`, `classKey`, `x`, `y`, `hp`, `maxHp` for another player's render (everything else — level/xp/damage/armor/cooldowns/flask/objectives/pending-action — withheld). Re-examined for combat, not copied blind:

- **Position/name/class/HP** are at least as relevant in combat as town (arguably more — seeing an ally's HP during a shared fight is standard genre behavior) — unchanged.
- **A distinct "in combat" indicator** was considered and **declined**. `PlayerPresence` has no clean `inCombat` boolean; the closest proxies are `pendingActionType`/`nextAttackAt`, both already withheld in 0.27 for being local-player-only UI/timer internals, not designed for third-party display. Manufacturing a derived "in combat" signal from those fields for this build alone would be new, un-reviewed design, not a port.
- **`lifeState` (downed)** was considered and **declined**, for consistency: the local player's own placeholder does not react to its own `lifeState` in *either* room type today (only the DOM HUD does), and a downed player's death is already separately visualized via the existing `hasCorpse`/corpsePosition marker (room-kind-agnostic, unaffected by this build). Adding a downed-only visual for *other* players' live placeholders, while self's own placeholder still doesn't react to it, would introduce the exact asymmetry 0.27 explicitly declined to add — not a decision to make silently as a side effect of a port.

**Decision: same six-field whitelist, unchanged, re-confirmed rather than assumed.** `lifeState`-driven visuals are named as a considered-and-declined candidate for a future build, not silently dropped.

## Wrinkle 3 — Same-zone matchmaking with a second real player

`zoneMatchmaking.test.ts` already proves two joins for the same `requestedZoneId` land in the same `roomId` (Core 0.7's `.filterBy` hotfix) — but only checks `roomId`/`zoneId` equality with a single shared `userId`, never `playerPresence` cross-visibility. That's the same gap 0.27 found and closed for TownRoom's matchmaking (which needed no filter at all): the *rooms* were already known to match, but no test ever proved a second real session's *replicated state* actually contains the first. This build closes that specific gap for CombatRoom.

## Proposed implementation

1. **No client code changes** — the rendering path is already shared and generic (Build framing above). Confirmed live (see Verification).
2. New server test, `apps/server/test/combat/multiPlayerPresenceVisibility.test.ts`, mirroring `apps/server/test/town/multiPlayerPresenceVisibility.test.ts` exactly (same `waitUntil` helper, same replicated-client-state assertions): two real clients `joinOrCreate("combat", { requestedZoneId: "blackwire_sewers" })`, proving same room, cross-visible replicated presence (six whitelisted fields), live position broadcast, and leave-removal.
3. New server test, `apps/server/test/combat/twoPlayerAggroAcquisition.test.ts`: two real players in one CombatRoom, proving an enemy acquires whichever is nearest and correctly re-acquires the other when the current target dies/leaves/leashes — the first real test of Wrinkle 1's "already safe by construction" claim.
4. Live check: two Playwright contexts, both characters routed from Nightmarket into the same combat zone (Blackwire Sewers) via the real gate/route flow, confirming visibility (screenshot + Debug Panel "Connected players"/"Player presence" text, same technique as 0.27) and watching simultaneous combat against a shared enemy for anything that reads as unfair or broken.

## Non-goals

```text
any change to aggro/targeting/attack logic -- Wrinkle 1 concludes it's already correct; this build adds proof, not a fix
expanding the other-player field whitelist -- Wrinkle 2 keeps it identical to 0.27, lifeState named as a declined-for-now candidate
zone capacity enforcement -- still unenforced, still the queued 0.27 follow-up, not pulled into this build
spawn-position staggering in combat entry -- same accepted cosmetic-quirk call as 0.27, not revisited here
```

## Risks

1. **The "no client change needed" claim is the load-bearing assumption of this whole build.** Verified two ways: a server-side test proving replicated presence in a real CombatRoom, and a live visual check in an actual combat zone — not asserted from code-reading alone.
2. **Simultaneous combat against one enemy is new, unverified ground** (Wrinkle 1's actual live behavior, not just its code shape). The live check watches specifically for this; no pre-committed fallback mechanic is designed since the architecture is already correct by construction — if something does look wrong, that becomes a named follow-up rather than an improvised in-session fix.

## Verification

- `pnpm --filter @doomscrolls/server test` — new coverage above, full suite green.
- `pnpm -r typecheck` clean.
- Live two-context Playwright check (scratchpad script, same technique as 0.27 — not a repo dependency), both sessions routed into Blackwire Sewers, confirming cross-visibility and observing simultaneous combat.
- No commit unless the working tree is already clean.

---

## Outcome

**Confirmed: no client code changes were needed.** `worldSessionAreaView.ts`'s `otherPlayerPlaceholders` rendering (built in 0.27) already ran unmodified in a real CombatRoom session — verified both by a server-side replicated-state test and by an actual browser rendering the tinted placeholder correctly in Blackwire Sewers.

### What was added

- `apps/server/test/combat/multiPlayerPresenceVisibility.test.ts` — the CombatRoom counterpart to 0.27's TownRoom test (join-visibility with the same six-field whitelist, live position broadcast, leave-removal), reusing `waitUntil` unchanged.
- `apps/server/test/combat/twoPlayerAggroAcquisition.test.ts` — proves Wrinkle 1 with two real players: an enemy targets the in-range player over a far-away one, then correctly re-acquires the surviving player once the original target also leaves range. Passed on the first run, confirming the 0.24-ported aggro logic was already correct, just never exercised with two real sessions.
- No changes to any client file, `PlayerPresence.ts`, `CombatRoomState.ts`, `CombatRoom.ts`, or the field whitelist.

### Wrinkles, resolved

1. **Aggro/targeting** — already correct by construction (proximity-scan-all-players, ported in 0.24); now proven with two real players, not just reasoned about. No logic change.
2. **Field whitelist** — re-confirmed unchanged (six fields). `lifeState`/downed-state and a synthetic "in combat" indicator were both explicitly considered and declined, for the same self-consistency reasons as 0.27.
3. **Same-zone matchmaking** — `zoneMatchmaking.test.ts` already proved room-level reuse; the new test additionally proves actual replicated-presence cross-visibility between two real sessions in the same CombatRoom, which had never been checked.

### Live check (two real Playwright browser contexts, Blackwire Sewers)

Routed both real accounts/characters directly into `blackwire_sewers` via a direct DB write to `Character.currentZoneId` (same shortcut technique 0.24's live check used), since navigating there through the in-game gate UI proved too pixel-fragile to script reliably and isn't itself part of this build's surface. Confirmed:

- Both sessions landed in the same CombatRoom (`Room kind: combat`, `Zone ID: blackwire_sewers`, `Connected players: 2` in both contexts).
- Each context's Debug Panel "Player presence" list showed both real characters by name with correct HP (45/45 gravewalker, 55/55 ironclad).
- **Visual confirmation:** after moving the two characters to distinct positions, each context rendered the other's placeholder with the correct name label and the correct class tint (ironclad's rust-orange, matching `classTint.ts` exactly) — visually identical in kind to 0.27's TownRoom result, alongside two real enemies (Trashboar Runt/Skitter, both idle) rendering normally in the same view.
- Closing one context dropped the other's "Connected players" to 1 and removed the other placeholder from view, with no error.
- Simultaneous-combat behavior was not additionally stress-tested live beyond this (the two-player aggro logic is already proven server-side in `twoPlayerAggroAcquisition.test.ts`, and `request_attack` was confirmed by code inspection to apply damage/rewards per-client independently, with no shared-lock or "already being attacked" gate that two real attackers could trip).

### Validation

```bash
pnpm --filter @doomscrolls/server test   # 36 files / 57 tests, all green
pnpm -r typecheck                        # clean
```

No commit made — the working tree was not clean before this session's work began, so per standing rule no commit was made.

---

## Follow-up check — simultaneous-in-range aggro (not just sequential)

`twoPlayerAggroAcquisition.test.ts` only ever had one of the two real players in range at any given moment (far/near, then re-acquire after a swap) — it never proved the case where both are in range of the same enemy **at the same time**, which is the scenario most likely to surface a real 0.24-era gap now that two real players can actually trigger it (target flip-flopping, or a hit landing on the wrong/both players).

**Result: already correct. No bug found, no fix needed.** Read closely, `applyCombatEnemyAggroDamage` ([CombatRoom.ts:1544-1769](apps/server/src/realtime/rooms/CombatRoom.ts#L1544-L1769)) recomputes the closest player every tick, but only ever **writes** `enemy.targetPlayerSessionId` inside the `if (enemy.targetPlayerSessionId.length === 0)` branch — once a target is committed, later ticks' closest-player scan is computed but never used to override it. The target only changes when the *current* target becomes actually invalid (dead, disconnected, out of aggro range, or the enemy exceeds leash range), never because a different player happened to be closer. Landing (`enemy.attackLandingAtMs > 0` branch) resolves and writes `.hp` on exactly one `landingTarget` object — there is no code path that touches more than one player's hp per landed attack.

New test, `apps/server/test/combat/simultaneousInRangeAggro.test.ts`: both real players placed equidistant from the enemy's spawn point (a genuine tie, not just "both in range"), both present before the enemy has ever had a target. Proves, empirically:
1. Exactly one of the two gets committed as `targetPlayerSessionId` (never stays empty, never both).
2. Sampled every ~50ms across 16 ticks (~800ms) while both stay alive and in range, the committed target **never flips** — only one sessionId is ever observed.
3. After a full telegraph/windup/landing cycle, only the committed target's hp drops; the untargeted player's hp stays exactly unchanged, and the target is still the same session afterward (landing doesn't itself cause a re-acquisition).

Passed on the first run — this is genuinely pre-existing-correct behavior, not a fix.

**No live check performed for this specific question, and that's a deliberate call, not an oversight.** This is a server-authoritative timing/consistency question with an exact, deterministic answer (does a schema field ever get reassigned; does an hp write ever touch more than one object) — a vitest test running against real tick timing answers it more rigorously than a browser screenshot could (a live check adds network/render noise, not more certainty, for this specific question). The live check in the main build above was necessary because it answered a *client-rendering* question vitest structurally cannot see; this question isn't that.

**One incidental observation, explicitly out of scope and not fixed:** `canReacquireWhileReturning` ([CombatRoom.ts:1618](apps/server/src/realtime/rooms/CombatRoom.ts#L1618)) is unreachable dead code — by the time it's evaluated, `enemy.state` can never actually be `"returning"` (the earlier `if (targetPlayerSessionId.length === 0 && state === "returning")` branch always returns first). This is not new and not CombatRoom-specific: `TownRoom.ts:3434` has the byte-for-byte identical structure, confirmed by direct comparison, so it predates this build and both ports share it. It doesn't cause incorrect behavior (the dead branch never changes an outcome), so it's noted here for the record and not touched.

### Validation

```bash
pnpm --filter @doomscrolls/server test   # 37 files / 58 tests, all green
pnpm -r typecheck                        # clean
```

No commit made (same standing-rule reason as above).
