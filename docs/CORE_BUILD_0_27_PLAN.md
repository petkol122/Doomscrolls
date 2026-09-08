# docs/CORE_BUILD_0_27_PLAN.md — Core Build 0.27 Plan

## Status

**Implemented and verified.** Same weight class as 0.24: a mechanism that was architecturally present but had never actually been experienced. Plan approved with three explicit decisions (TownRoom-only; placeholder + class tint, no new art; hard snap, no interpolation) plus a `PlayerPresence` field-visibility audit folded in before implementation. Waves 2-4 completed in this session: new vitest coverage, a live two-browser-context Playwright check (a first for this project), full suite green. See `docs/CORE_BUILD_0_27_RELEASE_NOTES.md` for full detail.

---

## Core 0.27 Theme

**Multiplayer Player Visibility — Rendering Other Connected Players in TownRoom**

---

## Build Framing — Current State (audited 2026-09-06)

### The gap is 100% client-side. There is no server gap.

`TownRoomState`/`CombatRoomState` both declare `@type({ map: PlayerPresence }) public playerPresence = new MapSchema<PlayerPresence>()` ([TownRoomState.ts](apps/server/src/realtime/rooms/TownRoomState.ts), [CombatRoomState.ts](apps/server/src/realtime/rooms/CombatRoomState.ts)). Colyseus schema sync mirrors the **entire** `playerPresence` map to **every** connected client by default — there is no `@filter`/`@filterChildren` decorator anywhere in this codebase restricting a client to its own entry. So the moment two real accounts are in the same room, each client's `room.state.playerPresence` already contains both entries, live, today.

And two real accounts already **do** land in the same room today, confirmed at the registration site:

```ts
// createRealtimeServer.ts:123 — no .filterBy on TownRoom
realtimeServer.define(TOWN_ROOM_NAME, TownRoom);
// createRealtimeServer.ts:140 — CombatRoom IS zone-filtered (Core 0.7 hotfix)
realtimeServer.define(COMBAT_ROOM_NAME, CombatRoom).filterBy(["requestedZoneId"]);
```

`TownRoom` has no `.filterBy` because it has never needed one — `nightmarket` is the only `roomType: "town"` zone that exists ([zones.ts](packages/content/src/data/zones.ts)). Colyseus's default `joinOrCreate("town", ...)` therefore reuses any existing open town room. Two players logging in right now are **already** joined to the same live `TownRoom` instance, already exchanging full `PlayerPresence` state over the wire. Nothing about that is new or needs building.

The client, however, only ever narrows this down to itself:

- `getCurrentPlayerPresence(state, sessionId)` ([townRoomPresence.ts:155-165](apps/client/src/net/townRoomPresence.ts#L155-L165)) does `getTownRoomPresence(state).players.find(p => p.sessionId === sessionId)` — it already has the full list, and immediately throws away everyone but self. All 8 call sites are in `worldSessionOverlayView.ts`, all building the local HUD only (objectives panel, debug info) — never another player.
- `worldSessionAreaView.ts`'s `refreshFromRoomState` does the identical narrowing inline at [line 862](apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts#L862): `presence?.players.find(p => p.sessionId === nextRoom.sessionId)`. Exactly **one** `playerPlaceholder` object exists in the whole view, created once at setup ([line 269](apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts#L269)).
- The one place the client already loops over `presence.players` for *everyone* is the corpse-marker block ([worldSessionAreaView.ts:1116-1220](apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts#L1116-L1220)) — real prior art for "render something per other player," just not a live moving sprite yet.

So: **0.27 requires no new server room/gameplay logic.** It is a client-rendering feature, plus locking down with a real test something that today only works by accident of "nobody ever asked."

### A real, explicit project rule this build runs directly into

`docs/CODING_RULES.md` states, twice, in the player-position and movement-step sections:

> "Client rendering must use synced room-state x/y only; it must not fake local movement, prediction, interpolation, smoothing or instant teleports on click" ([line 475](docs/CODING_RULES.md#L475))
> "client code must not fake local movement, prediction, smoothing, interpolation or invented position updates in this layer" ([line 497](docs/CODING_RULES.md#L497))

This is exactly the requirement the task brief asks 0.27 to soften ("interpolation between server updates, not a snap-to-teleport look"). See Question 3 — this is not silently overridden here.

### Two smaller, real gaps found during the audit

- `PlayerPresence.classKey` is synced by the server ([PlayerPresence.ts:36](apps/server/src/realtime/rooms/PlayerPresence.ts#L36)) but the client's `getTownRoomPresence()` parser never extracts it — there is no `applyOptionalClassKey` in the `applyOptional*` chain in `townRoomPresence.ts`. Any "differentiate players visually by class" feature needs this fixed first; it is a one-line gap, not a design question.
- No player art of any kind exists. The local player is a fixed-color ellipse/triangle/rectangle assembly ([worldSessionPlayerPlaceholderView.ts](apps/client/src/game/scenes/worldSession/worldSessionPlayerPlaceholderView.ts)), identical regardless of class. `VisualAssetCategory` already declares a `"player_sprite"` category ([types.ts](packages/content/src/data/types.ts)) but zero rows of that category exist in `visualAssets.ts` — it's unused, declared-but-empty. Equipped gear has no effect on the local player's rendered shape either. This sets the ceiling for what "another player" can realistically show in this pass (Question 2).

---

## Question 1 — Room Scope: TownRoom Only, or TownRoom + CombatRoom?

**Decided: TownRoom (Nightmarket) only for 0.27. CombatRoom visibility is a named, immediate follow-up build, not bundled in.**

**The case for Town-first:**
- Nightmarket is the only room *guaranteed* to hold multiple concurrent real players by construction (no zone filter, only one town zone exists, `maxPlayers: 30` in content vs. 4 for every combat zone). It is where players will actually see each other most, exactly as the task brief anticipated.
- CombatRoom's own retaliation logic just went live for the first time in 0.24 (multi-enemy aggro against multiple players, dodge-vs-telegraph timing, death/respawn) — all through a single-session lens in every live check performed so far. Adding a second real player's rendered presence into that same room is a second, independently-untested surface layered onto a first-build-old one. Per the exact reasoning 0.24's own Question 1 used to cut heavy attacks: landing two never-jointly-verified things in one pass means an odd live-check result can't be attributed to either cause alone.
- The implementation is the same mechanism in both rooms (`playerPresence` iteration, per-sessionId view Map) — proving it once in Town first, then porting to Combat as its own small, isolated build with its own live check, is strictly lower-risk than doing both at once, and costs little: the port itself should be near-mechanical once Town is proven.

**What's explicitly not addressed by this scope call:** whether another player fighting the same enemies in the same CombatRoom should show any combat-specific state (their HP bar during a fight, their attack telegraph, etc.) — that's the CombatRoom follow-up's own design question, not pre-answered here.

---

## Question 2a — PlayerPresence Field Audit: What's Actually Appropriate to Show

**This has never mattered before** — every field on `PlayerPresence` was already synced to every client in the room (Question/Build Framing above), but nothing ever read anyone else's entry, so no one ever had to decide which of its ~40 fields are fine for a third party to see versus merely "present because the schema is shared infrastructure." 0.27 is the first thing that makes that decision load-bearing. Auditing every field on `PlayerPresence.ts` explicitly, rather than wiring "whatever `PlayerPresenceEntry` happens to expose":

| Field(s) | Classify | Reasoning |
|---|---|---|
| `sessionId`, `characterId` | Internal only | Needed to key the Map/correlate entries; never displayed as content |
| `displayName` | **Show** | Already explicitly public by design (`GAME_DESIGN.md`: "Display name is public") |
| `classKey` | **Show (tint only)** | Not sensitive; used to pick a tint color, not rendered as a text label |
| `x`, `y` | **Show** | Position — explicitly named as fine in the task brief |
| `hp`, `maxHp` | **Show** | "HP-as-a-bar" — explicitly named as fine; reuses the existing `setInfo` numeric readout, the same one self already gets and the same granularity enemies already display live. No new bar art added (Question 2 below) |
| `lifeState` | **Not wired this pass** | Not a privacy call — but `worldSessionAreaView.ts`'s own local-player placeholder does not currently react to `lifeState` at all (only the DOM/HUD overlay does, self-only). Wiring a downed-state visual for other players only, when self doesn't get one in this same view, would be a new inconsistency, not a neutral default — left out for this build rather than invented on the spot |
| `spawnPointId` | Internal only | Not meaningful as display content |
| `movementSpeed` | Internal only | Drives nothing client-rendered for another player (hard snap doesn't need it — see Question 3) |
| `level`, `xp` | **Withhold** | Progression stats; grouped with the explicitly-excluded XP rather than assumed "fine like a nameplate level" — not in the task's explicit fine list, easy to add later if the user wants nameplate levels |
| `attackCooldownMs`, `damage`, `armor`, `lastAttackAt`, `nextAttackAt`, `nextDodgeAt` | **Withhold** | Exactly "exact stat numbers like damage/armor" from the task brief — never surfaced for another player |
| `hasMovementTarget`, `targetX`, `targetY` | **Withhold** | Movement-intent internals (their queued destination); only current `x`/`y` is shown, never where they're headed before they arrive |
| `hasPendingAction`, `pendingActionType`, `pendingTargetId`, `pendingTargetX`, `pendingTargetY` | **Withhold** | Task 207's "Moving to attack/interact/pickup" label is a local-player-only UI convenience (its own doc comment says so); not designed or approved for third-party display |
| `flaskCharges`, `maxFlaskCharges`, `nextFlaskAt` | **Withhold** | Consumable/loadout detail — reveals another player's remaining resources, not a glance-level fact |
| `nextSkillSlotAt`, `nextTertiarySkillSlotAt`, `nextPrimarySkillSlotAt` | **Withhold** | Combat cooldown internals |
| `hasObjective(2)`, `objectiveId(2)`, `objectiveLabel(2)`, `objectiveDescriptionKey(2)`, `objectiveCurrent(2)`, `objectiveTarget(2)`, `objectiveCompleted(2)`, `objectiveRewardGranted(2)`, `completedObjectiveIds`, `completedObjectiveTitles` | **Withhold** | Exactly "objective/quest progress" from the task brief |
| `hasCorpse`, `corpseX`, `corpseY` | Already shown (pre-existing, unaffected) | This predates 0.27 — the corpse-marker loop already renders another player's death location today. Not a new exposure decision this build is making; noted for completeness only |

**Resulting rule, made explicit in the implementation (not left implicit): the new other-player rendering code path reads exactly six fields off `PlayerPresenceEntry` — `sessionId` (key only), `displayName`, `classKey`, `x`, `y`, `hp`, `maxHp` — and nothing else, even though every other field remains reachable on the same object** (it has to stay reachable there because the *self* HUD legitimately needs objectives/flask/cooldowns/etc.). The discipline is enforced at the call site that builds another player's view, not by stripping fields from the shared parser.

---

## Question 2 — What Does "Another Player" Actually Show?

**Decided: reuse the exact existing local-player placeholder view, add exactly one cheap differentiator (a per-class tint color), and nothing else. No new art.**

Given the current art ceiling (no player sprites exist for anyone, including the local player; equipped gear has zero visual effect even for self), building real character-model rendering or equipment-driven visuals for *other* players in this pass would be scoping past what the local player itself gets — an inconsistency, and over-scoping into a full player-model system the task explicitly warned against.

Concretely, for each other connected player:
- **Shape**: the same container built by `createWorldSessionPlayerPlaceholderView` (shadow/ring/legs/torso/shoulders/head/direction-marker), not a new visual system.
- **Color**: a small `CLASS_TINTS` lookup keyed by `CharacterClassKey` (`gravewalker` / `ironclad`), the same *pattern* already used for `VARIANT_VISUALS` in `worldSessionEnemyPlaceholderView.ts` (a client-only cosmetic lookup keyed by a content id, not content-registry-driven, because it's presentation, not game data). Unknown/missing class falls back to the current blue. Whether to also apply this tint to the local player's own placeholder (for visual self-consistency) is a small free bonus, not required — noted as an option, not a decision this plan needs to force.
- **Name label**: reuse `setInfo(displayName, hp, maxHp)` verbatim — already exists, already synced, zero new code.
- **No HP bar drama, no equipment layering, no facing beyond the existing direction marker, no chat bubble, no click-to-target-another-player interaction.** Other players are visual-only, non-interactive entities from any other client's perspective — consistent with `PlayerPresence.ts`'s original "no chat, no gameplay" scope note, which stays true for this pass; only the *rendering* gap closes.

---

## Question 3 — Interpolation vs. the Existing "No Interpolation" Rule

This is the one place this plan cannot just proceed on its own judgment — it runs directly into an explicit, twice-stated project rule (see Build Framing above), and needs an explicit decision before Wave 2.

**Decided: Option A — hard snap, zero interpolation, no cosmetic tween.** Every other player's container gets `setPosition(x, y)` on each `onStateChange`, exactly like the local player and every enemy already do. This is fully consistent with `docs/CODING_RULES.md` as written (no rule-doc change needed) and with the local player's own already-shipped movement, which looks the same way. Adding a tween — even a narrowly-scoped, never-diverging one — was considered (Option B, previously the recommendation in this plan) but is explicitly **not** taken: the standing rule is respected as written, not reinterpreted or narrowed as a side effect of this build. "Handle position sync smoothness" is satisfied in the sense that another player's movement looks exactly as smooth (and exactly as snap-y) as the local player's own already-accepted feel — not by introducing new client-side smoothing.

---

## Question 4 — Room Capacity (`maxPlayers`) Enforcement

`maxPlayers` is authored per zone in content (`nightmarket: 30`, combat zones: `4`) but is **completely unenforced** — no `this.maxClients` assignment, no manual join-count rejection, anywhere in `TownRoom.ts`/`CombatRoom.ts`/`createRealtimeServer.ts` (confirmed: zero `maxClients` matches repo-wide). Rendering N other players raises the practical stakes of an unbounded population for the first time (visual clutter, per-tick projection cost for every container).

**Recommendation: accept as-is for 0.27, name it as an explicit queued follow-up ("Zone Capacity Enforcement"), not silently left open.** This gap is pre-existing and orthogonal to rendering — 0.27 doesn't make an unenforced cap more *wrong*, it just makes an already-possible-today scenario (many real players in Nightmarket) visible for the first time. Wiring `maxClients` now would be an unrelated fix bundled into a build whose live-check would then have two candidate causes for anything that looks off, the same reasoning 0.24 used to keep its own scope narrow.

---

## Point 5 — Interaction Risk With Existing Single-Player-Assumed Code

Audited every place that touches `playerPresence` for "does this assume exactly one entry / would it misbehave with a second real player":

| Code | Already multiplayer-safe? | Note |
|---|---|---|
| `stepTownRoomMovement` (50ms tick) | Yes | Already `state.playerPresence.forEach(...)`, steps every player toward their own target independently |
| `applyTownRestAreaRefillForAll` | Yes | Already loops all players |
| `CombatRoom.applyCombatEnemyAggroDamage` | Yes | Already picks nearest of *all* connected alive players per enemy (ported in 0.24, doc comment confirms multi-player is in scope) |
| `onLeave`'s "clear enemy target" loop | Yes | Correctly scoped to only the leaving session's `targetPlayerSessionId` |
| Vendor / stash / notice-board turn-in handlers | Yes | All scoped via `state.playerPresence.get(client.sessionId)` — per-session already |
| `getCurrentPlayerPresence` + HUD overlay | Unaffected | Self-only today, stays self-only — 0.27 only adds *new* consumption of the rest of the list, doesn't change these call sites |

**One real, concrete finding: fresh spawn placement is not staggered.** `buildTownPlayerPresence` always resolves the same `NIGHTMARKET_DEFAULT_SPAWN_POINT_ID` x/y for every player without a valid persisted location ([buildPlayerPresence.ts:67-93](apps/server/src/realtime/rooms/buildPlayerPresence.ts#L67-L93)) — two freshly-joined players will render exactly stacked on the same pixel until either moves. This is invisible today (nobody renders anyone else) and becomes a real, if minor and self-resolving, cosmetic artifact the instant 0.27 ships.

**Recommendation: accept as a known cosmetic quirk for v1, call it out explicitly rather than silently missing it.** It resolves itself the moment either player takes one step, and fixing it means touching spawn-placement logic that also has to keep the persisted-location-restore path correct — an unrelated risk surface not worth bundling in for a cosmetic-only fix. If the user wants it fixed anyway, it's a small, separately-reviewable addition (e.g. a small deterministic per-session offset), not a blocker to the rest of this build.

No other call site assumes single-presence in a way that would misbehave.

---

## Proposed Implementation Approach (for review, not yet executed)

**Client-only, plus one new server-side test file. No production server code changes.**

1. `apps/client/src/net/townRoomPresence.ts` — add `classKey?: CharacterClassKey` to `PlayerPresenceEntry`, add `applyOptionalClassKey` to the `applyOptional*` chain (mirrors the existing `applyOptionalSpawnPoint` shape exactly).
2. `apps/client/src/game/scenes/worldSession/worldSessionPlayerPlaceholderView.ts` — extend `createWorldSessionPlayerPlaceholderView`'s factory to accept an optional tint config (default = today's exact colors, so nothing changes for the local player unless Question 2's bonus is taken).
3. New small constant, e.g. `apps/client/src/game/scenes/worldSession/classTint.ts` — a `CLASS_TINTS: Record<CharacterClassKey, {...}>` lookup, same pattern as `VARIANT_VISUALS` in `worldSessionEnemyPlaceholderView.ts`.
4. `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts` — in `refreshFromRoomState`'s section [C] (next to the existing corpse-marker loop, which already iterates `presence.players`):
   - `otherPlayerPlaceholders = new Map<string, WorldSessionPlayerPlaceholderView>()` at module/view scope, alongside the existing `enemyPlaceholders` Map.
   - Compute `others = presence.players.filter(p => p.sessionId !== nextRoom.sessionId)`.
   - Diff current sessionIds against the Map's keys — destroy-and-delete removed sessions, create-on-first-sight new ones — the identical create/refresh/destroy-by-id idiom already used for `enemyPlaceholders`. This is how "someone joining/leaving while you're in the room" is handled: not a literal Colyseus `.onAdd`/`.onRemove` schema callback (this codebase doesn't use those anywhere), but the same per-`refreshFromRoomState`-call set-diff already proven for enemies/loot/corpses.
   - For each, project world→screen with the same `worldToScreenActiveProjection` already used for self/enemies (camera stays centered on the local player, unaffected), call `.setPosition` (hard snap, Question 3) and `.setInfo(displayName, hp, maxHp)` — reading only the six whitelisted fields from Question 2a, nothing else off the entry.

No changes to `PlayerPresence.ts`, `TownRoomState.ts`, `TownRoom.ts`, `buildPlayerPresence.ts`, or any server-side movement/combat logic.

---

## Verification Strategy

### New vitest coverage (`apps/server/test/town/`) — this is the part that has never been tested

No existing test connects two real `colyseus.sdk.joinOrCreate` clients into the same room simultaneously (confirmed: every test that mentions "race"/concurrent behavior, e.g. `objectiveTurnInRace.test.ts`, races two *messages* from one client, not two real sessions). This is genuinely new test-writing ground, though the harness (`createTestRealtimeServer`, `waitForMessage`, `fixtures`) needs no changes.

New file, e.g. `apps/server/test/town/multiPlayerPresenceVisibility.test.ts`, following the exact `enemyAggroAcquisition.test.ts` pattern (boot once in `beforeAll`, `cleanup` in `afterEach`, `shutdown` in `afterAll`):

- **Join visibility**: two real clients join `"town"` with two distinct `characterId`/`userId` fixtures. Assert both land in the same `roomId`. Assert each session's own `room.state.playerPresence` (fetched via `colyseus.getRoomById`) has `size === 2`, and that the entry keyed by the *other* session's `sessionId` carries the expected `displayName`/`classKey`/`x`/`y`.
- **Live broadcast, not just join-time snapshot**: mutate player A's `x`/`y` directly on the server-side schema (or send a real `request_move` + advance the room's simulation interval, matching how other movement tests already drive ticks), then assert player B's view of A's entry reflects the new position — proves the sync is live, not just present once at join.
- **Leave removes the entry**: disconnect client A (`client.leave()`), assert player B's `playerPresence` map no longer contains A's `sessionId` — the server-side proof underpinning the client's "someone left the room" case.

### Live Playwright check — two real sessions, since one client cannot prove another client sees it

There is no Playwright installed or checked in anywhere in this repo today (confirmed repo-wide). Every prior live check (0.23-0.26) was a single-session, agent-driven interactive browser check, not a checked-in spec — this build needs the same approach extended to **two independent browser contexts**, which is new ground for this project and is designed here explicitly rather than improvised live, per the task's own instruction:

1. Bring up the real stack via `pnpm dev:all` (docker-compose infra + client + server), the same environment every prior live check has used.
2. Open **two separate Playwright browser contexts** (`browser.newContext()` twice, each with its own isolated cookie/localStorage jar — this is Playwright's default per-context isolation, not something that needs building) against the same client dev URL, each driving its own `page`.
3. Context A: register a real account, create a character (class: `gravewalker`), enter world → lands in Nightmarket. Context B: register a second real account, create a character (class: `ironclad` — deliberately the *other* class, so the tint differentiator from Question 2 is also visible in the same check), enter world → also lands in Nightmarket (guaranteed same room per the no-`.filterBy` finding above).
4. Sanity anchor before the visual check: the existing HUD debug line already shows `connectedPlayerCount` (localization key `world_session.connected_players`, sourced straight from `TownRoomState.connectedPlayerCount`) — confirm it already reads "2" in both contexts. This line is pure text, unaffected by the rendering gap, and is a cheap, already-existing ground truth to check before trusting anything visual.
5. Take a screenshot in context A showing a second placeholder (context B's character) at a rendered position, with the expected name label and a visibly different tint than A's own. Same in reverse for context B.
6. Move character A via click-to-move; screenshot both contexts again; confirm context B's rendering of A visibly moved to the new location. To make this numerically checkable rather than eyeballed, extend the same debug-position-label convention the local player already gets (`x=..., y=...`) to also render under each other-player placeholder for this check — a small, dev-visible debug aid consistent with existing precedent, not new gameplay UI.
7. Close context A's page (simulating leave); confirm context B's rendering of A's placeholder disappears within one state patch.

**Gates:** `pnpm --filter @doomscrolls/server typecheck`, `pnpm -r typecheck`, `pnpm --filter @doomscrolls/server test` must all pass. No commit unless the working tree is already clean.

---

## Core 0.27 Non-Goals

```text
CombatRoom player visibility -- explicitly cut for sequencing reasons (Question 1), queued as an immediate follow-up build once TownRoom rendering is live-verified, not indefinitely deferred
chat / any player-to-player communication -- was never in scope for PlayerPresence and stays that way; this build is rendering-only
any interaction with another player's rendered entity (click-to-target, PvP, trading, grouping) -- other players remain non-interactive visual entities this pass
real character-model art, spritesheets, or equipped-gear visual layering for any player, self included -- the current art ceiling doesn't support it for the local player either; scoped down to a reused placeholder + a class tint (Question 2)
zone/room capacity enforcement (maxPlayers) -- explicitly accepted as unenforced for this build (Question 4), queued as a named follow-up, not left as an open risk
fresh-spawn position staggering -- accepted as a known, self-resolving cosmetic quirk (Point 5), not fixed in this pass unless the user asks for it explicitly
any server-side room/gameplay logic change -- the data layer already supports this feature; 0.27 is client rendering plus a new regression test, not new server logic
```

---

## Candidate Task Waves

### Wave 1 — Planning
- [x] This document + checklist
- [x] Confirm the gap is client-only by auditing schema sync, `.filterBy` registration, and every `playerPresence` consumption site
- [x] Confirm no existing test connects two real sessions to the same room
- [x] Surface the interpolation rule conflict explicitly (Question 3) rather than deciding unilaterally

### Wave 2 — Core Client Rendering
- [ ] `townRoomPresence.ts`: add `classKey` extraction
- [ ] `worldSessionPlayerPlaceholderView.ts`: optional tint parameter
- [ ] New `classTint.ts` lookup
- [ ] `worldSessionAreaView.ts`: `otherPlayerPlaceholders` Map + create/refresh/destroy-by-sessionId diff, reusing the corpse-marker loop's existing `presence.players` iteration, reading only the six whitelisted fields (Question 2a) and hard-snapping position (Question 3, no tween)

### Wave 3 — Verification (priority)
- [ ] `apps/server/test/town/multiPlayerPresenceVisibility.test.ts`: join-visibility, live-broadcast, leave-removes-entry
- [ ] Full existing suite stays green
- [ ] `pnpm -r typecheck` clean

### Wave 4 — Live Check and Docs
- [ ] Two-context Playwright live check per the Verification Strategy above, outcome reported (not assumed)
- [ ] `docs/CORE_BUILD_0_27_RELEASE_NOTES.md`, naming the CombatRoom follow-up and any other queued items explicitly

---

## Queued Follow-Up Builds

1. **CombatRoom Player Visibility** — port the same mechanism into `CombatRoom`'s equivalent view, once Town rendering is live-verified. Its own design question: does another player's combat state (HP during a fight, telegraph visibility) belong in v1 of that follow-up, or stay purely positional like Town's v1.
2. **Zone Capacity Enforcement** — wire `maxPlayers` from content into an actual `this.maxClients` (or manual join-count rejection) for both room types.
3. (Optional, only if the user wants it addressed rather than accepted) **Spawn Position Staggering** — deterministic per-session offset so simultaneous fresh joins don't render exactly stacked.

---

## Risks

1. **Interpolation vs. the existing coding rule (Question 3) — resolved.** Decided as hard snap, respecting `docs/CODING_RULES.md` exactly as written; no rule-doc change made or needed.
2. **Rendering cost with many connected players.** `refreshFromRoomState` already only runs on `onStateChange` (bounded by Colyseus's patch cadence, not per-frame), and the enemy/loot/corpse Map-diff pattern this build reuses is already proven at the scale those entity types reach. Realistic live-check coverage is capped at however many real sessions can be opened in one check (likely 2-3), not the full theoretical 30 `maxPlayers` — noted as a coverage gap, not a blocker.
3. **Spawn-stacking cosmetic overlap (Point 5).** Accepted as-is; self-resolving on first movement; named explicitly rather than silently discovered live.
4. **Two-context Playwright verification is new procedure for this project.** Designed above in concrete steps before implementation, per the task's explicit instruction, rather than improvised during the live check itself.
5. **`classKey` now reaches every client in the room, not just the owning account.** Not actually a privacy concern — `displayName` is already broadcast to everyone in the room today, and class choice is not sensitive data — but worth naming explicitly since it's new cross-account data exposure, however trivial.

---

## Summary

The data plumbing for multiplayer visibility already exists and already works — two real accounts already share one `TownRoom` instance today and already exchange full presence state; the entire gap is that the client only ever renders and reads back its own entry, and never had to decide which of that entry's ~40 fields are appropriate to show a third party. 0.27 closes both gaps: it reuses the existing placeholder view (tinted by class, not new art), the existing corpse-marker Map-diff idiom (extended to a live per-player Map instead of a static marker), and a small classKey-parsing fix — while explicitly whitelisting only six fields (`displayName`, `classKey`, `x`, `y`, `hp`, `maxHp`) for the new other-player rendering path, withholding everything progression/combat/objective-related even though it remains technically reachable on the same parsed object. No new server gameplay logic. Scope is deliberately narrowed to TownRoom only (Question 1) with a hard-snap render, no interpolation (Question 3, respecting the standing rule as written) — CombatRoom visibility is named as the immediate next build rather than bundled in, matching this project's established sequencing discipline (0.24's Question 1).
