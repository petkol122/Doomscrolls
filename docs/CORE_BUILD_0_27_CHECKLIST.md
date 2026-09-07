# docs/CORE_BUILD_0_27_CHECKLIST.md — Core Build 0.27 Checklist

---

## Core 0.27 Planning Open Checklist

**Date:** 2026-09-06
**Build:** Core Build 0.27
**Theme:** Multiplayer Player Visibility — Rendering Other Connected Players in TownRoom
**Status:** Implemented and verified. Plan approved with three decisions (TownRoom-only; placeholder + class tint, no new art; hard snap, no interpolation) plus a PlayerPresence field-visibility audit folded in, then Waves 2-4 completed in this same session. See `docs/CORE_BUILD_0_27_RELEASE_NOTES.md` for full detail.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_27_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_27_CHECKLIST.md`
- [x] Confirm `PlayerPresence`'s full field shape and its "no chat, no gameplay" scope note (now partially stale, but the exclusion itself still holds for this build)
- [x] Confirm `TownRoomState`/`CombatRoomState` both declare `playerPresence` as a plain synced `MapSchema`, with no field-level filtering anywhere in the codebase
- [x] Confirm, at the exact registration site, that `TownRoom` has no `.filterBy` (only one town zone exists) and therefore already funnels concurrent real accounts into the same live room instance — the data-layer gap the task described turns out not to exist; only rendering does
- [x] Confirm `CombatRoom`'s `.filterBy(["requestedZoneId"])` (Core 0.7 hotfix) so same-zone concurrent players already share a room there too, informing (not deciding away) Question 1
- [x] Audit every `getCurrentPlayerPresence` call site (8, all in `worldSessionOverlayView.ts`) and confirm every one builds the local HUD only, never another player
- [x] Audit `worldSessionAreaView.ts`'s `refreshFromRoomState` and confirm exactly one `playerPlaceholder` object exists, hard-set via `setPosition` on every state change, with no interpolation anywhere in the client (confirmed by explicit doc-comment disclaimers, not just absence of code)
- [x] Identify the corpse-marker loop as existing prior art for "iterate all players' presence and render something," distinct from a live moving sprite
- [x] Confirm no existing enemy/variant visual system requires a new pattern — `worldSessionEnemyPlaceholderView.ts`'s create/refresh/destroy-by-id Map and `VARIANT_VISUALS` lookup are directly reusable precedents
- [x] Confirm the client-side `classKey` parsing gap: server syncs it, `townRoomPresence.ts`'s `applyOptional*` chain never extracts it
- [x] Confirm no player art exists for anyone (including the local player) and that `VisualAssetCategory`'s `"player_sprite"` category is declared but has zero rows — sets the v1 fidelity ceiling (Question 2)
- [x] Find and quote the two explicit `docs/CODING_RULES.md` lines banning client-side interpolation/smoothing/prediction, and treat the conflict with the task's "not a snap-to-teleport look" ask as a real decision point, not something to route around silently (Question 3)
- [x] Confirm `maxPlayers` is authored per zone in content but completely unenforced anywhere (zero `maxClients` references repo-wide) — factored into Question 4
- [x] Audit every place `playerPresence` is iterated or assumed-single (movement stepping, rest-area refill, enemy aggro acquisition, onLeave enemy-target-clear, vendor/stash/notice-board handlers) for multiplayer-safety — all already safe except one real finding
- [x] Find the one real single-player-assumed gap: fresh spawn placement always resolves the same shared spawn-point coordinate, so simultaneous fresh joins render stacked (Point 5) — named explicitly, not silently missed
- [x] Confirm no existing vitest connects two real `colyseus.sdk.joinOrCreate` clients into the same room simultaneously (checked every test whose name suggested concurrency — all race two *messages* from one client, not two sessions) — this is genuinely new test-writing ground
- [x] Confirm Playwright is not installed or checked in anywhere in this repo, and that every prior live check (0.23-0.26) was single-session — a two-context check is new procedure for this project and must be designed here, not improvised live
- [x] Design the two-Playwright-context live check concretely (two accounts, two classes for tint contrast, existing `connectedPlayerCount` debug line as a numeric sanity anchor, a debug position label extended to other players for a numeric before/after check) before implementation starts
- [x] Match `docs/CORE_BUILD_0_24_PLAN.md`'s full-format structure (Status/Theme/Build Framing/numbered Questions/Proposed Implementation/Verification Strategy/Non-Goals/Waves/Follow-ups/Risks/Summary) since this build touches the same weight class (foundational, server-adjacent, requiring a live check)
- [x] Define candidate task waves
- [x] Define explicit 0.27 non-goals
- [x] Define the 0.27 risk list, each with why it's accepted or how it's mitigated
- [x] Name queued follow-up builds explicitly (CombatRoom Player Visibility; Zone Capacity Enforcement; optional Spawn Position Staggering), not as vague "later" items
- [x] Audit every field on `PlayerPresence` explicitly for "fine to show another player" vs. "not something that was ever decided to be shown," now that rendering makes this load-bearing for the first time (Question 2a) — classified all ~40 fields, whitelisted exactly six (`sessionId` key-only, `displayName`, `classKey`, `x`, `y`, `hp`, `maxHp`) for the new other-player render path
- [x] Get this plan reviewed/approved before starting Wave 2 — approved with three explicit decisions: TownRoom-only (Question 1), placeholder + class tint only / no new art (Question 2), hard snap / no interpolation, respecting `docs/CODING_RULES.md` as written (Question 3)

### Core 0.27 Scope Guardrails (for implementation, once approved)

- [x] No server-side room/gameplay logic is changed — `PlayerPresence.ts`, `TownRoomState.ts`, `TownRoom.ts`, `buildPlayerPresence.ts`, `stepTownRoomMovement.ts` stay untouched
- [x] CombatRoom rendering is **not** touched this build (Question 1) — queued as an immediate named follow-up
- [x] No real character-model art, spritesheets, or equipment-driven visuals are added — v1 stays a tinted reuse of the existing placeholder shape (Question 2)
- [x] No chat, no player-to-player interaction, no click-to-target another player
- [x] `maxPlayers` stays unenforced this build (Question 4) — named as a queued follow-up, not silently left open
- [x] Fresh-spawn stacking is accepted as a known cosmetic quirk (Point 5) — confirmed live: both test characters spawned exactly stacked at the same on-screen position until one moved, exactly as predicted
- [x] Position rendering for other players is a hard `setPosition` snap only — no tween, no smoothing, respecting `docs/CODING_RULES.md` exactly as written (Question 3, decided)
- [x] The other-player render call site reads only the six whitelisted fields from Question 2a (`sessionId` as Map key, `displayName`, `classKey`, `x`, `y`, `hp`, `maxHp`) — no level/xp/damage/armor/flask/cooldowns/objectives/pending-action fields are threaded into it even though they remain on the parsed entry for self's own HUD use
- [x] Every new client behavior is covered by the new server-side vitest file, not a throwaway scripted client
- [x] A live two-context Playwright check is performed and its outcome reported, not assumed — passed on every dimension (see Wave 4 below)

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.27 scope documents
- [x] Reconfirm the current full server test suite as the regression baseline 0.27 must not break

#### Wave 2 — Core Client Rendering

- [x] Add `classKey` extraction to `townRoomPresence.ts`'s `applyOptional*` chain
- [x] Extend `worldSessionPlayerPlaceholderView.ts`'s factory with an optional tint parameter, defaulting to today's exact colors
- [x] Add a `CLASS_TINTS` lookup (new file `classTint.ts`), following the same pattern as `VARIANT_VISUALS` in `worldSessionEnemyPlaceholderView.ts`
- [x] Add `otherPlayerPlaceholders` Map + create/refresh/destroy-by-sessionId diff in `worldSessionAreaView.ts`, next to the existing corpse-marker loop, hard-snapping position and reading only the six whitelisted fields
- [x] `pnpm --filter @doomscrolls/client typecheck` clean

#### Wave 3 — Verification (priority)

- [x] `apps/server/test/town/multiPlayerPresenceVisibility.test.ts`: two real clients see each other on join (each session's own *replicated* client-side state, not just the server's authoritative copy)
- [x] Same file: live position broadcast (not just a join-time snapshot) proven by moving one player and observing the other's view update
- [x] Same file: leave removes the departed session's entry from the remaining player's view
- [x] New support helper `apps/server/test/support/waitUntil.ts` (polls a predicate against replicated client state — safer than racing a one-shot `onStateChange` subscription against a snapshot that may already have arrived)
- [x] Full existing suite stays green — 34 files / 54 tests total (33/52 baseline + 1 new file / 2 new tests)
- [x] `pnpm -r typecheck` clean

#### Wave 4 — Live Check and Docs

- [x] Two Playwright browser contexts (via a throwaway `playwright` script in the session scratchpad, run with `node` against the already-running `pnpm dev:all` stack — no Playwright dependency added to the repo), two real registered accounts, two different classes (gravewalker / ironclad), both entering Nightmarket
- [x] Confirmed the existing `connectedPlayerCount` HUD debug line (inside the dev-only Debug Panel disclosure) reads "2" in both contexts, and dropped to "1" in the remaining context after the other left
- [x] Bonus precise signal found live: the same Debug Panel's existing "Player presence" list already iterates *every* connected player (not just self) and lists both characters by name in both contexts — a stronger, exact DOM-text assertion than originally planned, used alongside the visual screenshot check
- [x] Screenshot confirmation: each context renders the other's placeholder with the expected name label and a visibly different class tint (context B's screen showed its own default-blue placeholder plus the other player's purple gravewalker-tinted placeholder, matching `classTint.ts` exactly)
- [x] Confirmed fresh-spawn stacking live (Point 5): both placeholders rendered exactly overlapping at the shared spawn coordinate until one moved
- [x] Moved one player via a real click-to-move; confirmed the other context's rendering visibly updated to the new position (screenshot comparison, name label moved with the placeholder)
- [x] Closed one context; confirmed the other's rendering of that player disappeared, "Connected players" dropped to 1, and no error/crash occurred in the remaining session
- [x] Write `docs/CORE_BUILD_0_27_RELEASE_NOTES.md`, naming the CombatRoom follow-up and Zone Capacity Enforcement explicitly as next builds
- [x] Full `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test` pass
- [x] No commit made — working tree was not clean before this session's work began (pre-existing uncommitted work from a prior session), so no commit was made per standing rule

### Explicit Non-Goals / Deferred Items

- [x] CombatRoom player visibility (queued as an immediate named follow-up build, "CombatRoom Player Visibility" — not indefinitely deferred)
- [x] Chat / player-to-player communication (was never in `PlayerPresence`'s scope; stays out)
- [x] Any interaction with another player's rendered entity (click-to-target, PvP, trading, grouping)
- [x] Real character-model art, spritesheets, or equipped-gear visual layering for any player
- [x] Zone/room capacity enforcement (explicit accept-as-is decision, queued as an immediate named follow-up build, "Zone Capacity Enforcement" — not left as an open risk)
- [x] Fresh-spawn position staggering (accepted as a known, self-resolving cosmetic quirk, optional named follow-up only if requested)
- [x] Any server-side room/gameplay logic change

### Planning Exit Criteria

- [x] Core Build 0.27 has a clear theme grounded in a direct audit of schema sync, room registration, and every `playerPresence` consumption site
- [x] The build framing correctly identifies this as a client-rendering + verification gap, not a server data-layer gap, with the exact evidence cited
- [x] The room-scope question (Town vs. Town+Combat) was answered with an explicit case, not defaulted, following the same sequencing discipline 0.24 used for its own scope cut
- [x] The "what does another player show" question was answered against the actual current art ceiling, not an aspirational one
- [x] The interpolation-vs-existing-rule conflict was surfaced explicitly as a decision requiring sign-off, not resolved unilaterally or silently
- [x] The capacity-enforcement gap and the fresh-spawn-stacking finding were each given an explicit decision (accept-as-is + named follow-up), not left as vague open risks
- [x] Core Build 0.27 has grouped candidate waves
- [x] Core Build 0.27 has explicit non-goals, including every cut item named as an immediate queued follow-up rather than a vague deferral
- [x] Core Build 0.27 has an explicit risk list
- [x] Core Build 0.27 has a verification strategy covering both the new server-side multiplayer test (the part that has never been tested) and a concretely-designed two-context live Playwright check (the part that requires two simultaneous real sessions to verify at all)
- [x] Plan reviewed and approved by the user
- [x] Implementation completed: Waves 2-4 done, all vitest coverage green, live two-context Playwright check passed on every dimension, release notes written
