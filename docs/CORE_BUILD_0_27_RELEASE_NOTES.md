# docs/CORE_BUILD_0_27_RELEASE_NOTES.md — Core Build 0.27 Release Notes

---

## Task — Multiplayer Player Visibility (TownRoom)

**Date:** 2026-09-07
**Build:** Core Build 0.27
**Status:** Implemented and verified.

### Summary

Other connected players in Nightmarket are now actually visible to each other for the first time. The underlying data plumbing already existed and already worked — `TownRoom` is registered with no `.filterBy` and only one town zone (`nightmarket`) exists, so two real accounts already landed in the same live room instance and Colyseus already synced the entire `playerPresence` MapSchema to both. The entire gap was that the client only ever rendered and read back its own presence entry. 0.27 closes that gap client-side only, with no server room/gameplay logic changes, plus a real regression test proving what had never been tested before: that a second session's own replicated state actually reflects another player's presence, live position updates, and removal on leave.

### What changed

- `apps/client/src/net/townRoomPresence.ts` — added `classKey` extraction (`applyOptionalClassKey`) to `PlayerPresenceEntry`. The server has synced this field since Core 0.9; no client reader had ever extracted it until it became user-visible for a third party.
- `apps/client/src/game/scenes/worldSession/classTint.ts` (new) — a `CLASS_TINTS` lookup keyed by `CharacterClassKey`, the same client-only cosmetic-lookup pattern already used by `VARIANT_VISUALS` in `worldSessionEnemyPlaceholderView.ts`. Gravewalker gets a purple/graveyard tint, Ironclad a rust/orange tint; unknown/missing class falls back to the existing default blue.
- `apps/client/src/game/scenes/worldSession/worldSessionPlayerPlaceholderView.ts` — the placeholder factory now accepts an optional tint parameter, defaulting to today's exact colors so the local player's own look is unchanged.
- `apps/client/src/game/scenes/worldSession/worldSessionAreaView.ts` — added an `otherPlayerPlaceholders` Map (keyed by sessionId), following the exact create/refresh/destroy-by-id idiom already used for `enemyPlaceholders`, sitting right next to the existing corpse-marker loop (which already iterated `presence.players`). Renders every connected player except self: hard `setPosition` snap (no tween), `setInfo(displayName, hp, maxHp)`, tinted by `classKey`.
- `apps/server/test/town/multiPlayerPresenceVisibility.test.ts` (new) — two real `colyseus.sdk.joinOrCreate` clients in the same room, proving each session's own *replicated* client-side state (not the server's authoritative copy, which would be trivially true by definition) contains the other's entry on join, updates live on movement, and loses the entry on leave.
- `apps/server/test/support/waitUntil.ts` (new) — a small polling helper for asserting eventual consistency of replicated client state, used instead of racing a one-shot `onStateChange` subscription against a snapshot that may already have arrived before the subscription was attached.

### The field-visibility audit (folded into planning before Wave 2)

Before any rendering code was written, every field on `PlayerPresence` was classified as fine to show another player or not something that was ever decided to be shown, now that rendering makes this decision load-bearing for the first time. The other-player render path reads exactly six fields — `sessionId` (Map key only), `displayName`, `classKey`, `x`, `y`, `hp`, `maxHp` — and nothing else. Level, XP, damage, armor, cooldown timers, flask charges, and both objective slots remain on the parsed `PlayerPresenceEntry` (self's own HUD still needs them) but are never threaded into the other-player view. See `docs/CORE_BUILD_0_27_PLAN.md`, Question 2a, for the full field-by-field table and reasoning.

### Non-goals held

- **CombatRoom rendering** — not touched. Queued as the immediate next build (see Queued follow-ups below).
- **Interpolation** — not added. Position rendering for other players is a hard `setPosition` snap, identical to how the local player and every enemy already render, respecting `docs/CODING_RULES.md`'s existing "must not fake local movement, prediction, interpolation, smoothing" rule exactly as written. No rule-doc change was made or needed.
- **New art** — none added. Other players reuse the exact existing vector-shape placeholder, differentiated only by a tint color.
- **Zone capacity enforcement** — `maxPlayers` stays unenforced (queued follow-up).
- **Fresh-spawn stacking** — accepted as a known, self-resolving cosmetic quirk; confirmed live (see Wave 4 below) rather than left as a theoretical risk.
- **No server-side room/gameplay logic changed** — `PlayerPresence.ts`, `TownRoomState.ts`, `TownRoom.ts`, `buildPlayerPresence.ts`, `stepTownRoomMovement.ts` are all untouched.

### Verification — vitest (`apps/server/test/`)

`multiPlayerPresenceVisibility.test.ts`, two cases:

1. Two real sessions join the same room; each session's own client-replicated state (read via the `@colyseus/sdk` client's `.state` getter, not the server's authoritative copy) is polled until it contains the other session's entry, then asserted for `displayName`/`classKey`/`x`/`y` in both directions. The server's authoritative `playerPresence.x`/`y` is then mutated directly and the *other* client's replicated state is polled until it reflects the new value — proving live broadcast, not just a join-time snapshot.
2. One client leaves; the remaining client's replicated state is polled until the departed session's entry is gone, and the server's own `playerPresence.size` drops to 1.

A real timing gap was found and fixed during this work: a client's `.state` object exists immediately after `joinOrCreate` resolves, but its fields (including `playerPresence`) are `undefined` until the first patch decode completes asynchronously — confirmed by direct inspection (a throwaway debug test logged the exact shape before and after a short wait). The initial implementation using a one-shot `waitForStateChange`-style event listener was replaced with a polling `waitUntil(predicate)` helper, which is robust regardless of whether the initial snapshot arrives before or after a listener could be attached.

Full existing suite: 34 files / 54 tests, all green (33/52 baseline + this build's 1 new file / 2 new tests). `pnpm -r typecheck` clean.

### Wave 4: the live two-context Playwright check

No Playwright is installed or checked into this repo, and every prior live check (0.23-0.26) was single-session. This build needed a genuine two-simultaneous-real-session check, designed concretely in the plan before implementation rather than improvised live. Executed via a throwaway Node script (`playwright` installed only in the session scratchpad, not added to the repo) driving the already-running `pnpm dev:all` stack (real Fastify/Colyseus server on :2567, real Postgres/Redis via the existing docker-compose infra, real Vite dev server on :5173):

- Two independent Playwright browser contexts, each registering a real account through the actual auth UI, creating a character (gravewalker / ironclad — deliberately the two different classes) through the actual character-creation UI, and entering Nightmarket through the actual "Enter World" flow.
- **Sanity anchor confirmed:** the existing Debug Panel's "Connected players" line read "2" in both contexts. A stronger signal was found live and used as well: the same Debug Panel's "Player presence" list already iterates *every* connected player (not just self) and listed both characters by name in both contexts — a more precise DOM-text assertion than the plan's original design, discovered during execution rather than planned in advance.
- **Visual confirmation (screenshots):** each context rendered the other player's placeholder with the correct name label and a visibly distinct class tint — context B's screen showed its own default-blue placeholder alongside the other player's purple gravewalker-tinted placeholder, matching `classTint.ts` exactly.
- **Fresh-spawn stacking (Point 5) confirmed live:** both placeholders rendered exactly overlapping at the shared spawn coordinate before either moved, exactly as the plan predicted.
- **Movement confirmed:** a real click-to-move was sent in context A; a follow-up screenshot in context B showed the other player's placeholder and name label had moved to the new position, with no interpolation artifact (consistent with the hard-snap decision).
- **Leave/removal confirmed:** closing context A's browser context caused context B's "Connected players" count to drop to 1, the other placeholder to disappear from B's canvas, and no error or crash in B's session.

Every dimension designed in the plan's Verification Strategy passed.

### Queued follow-ups (named explicitly, as the plan requires)

1. **CombatRoom Player Visibility** — port the same mechanism into `CombatRoom`'s equivalent view, once this build is confirmed stable. Its own open design question: whether another player's combat state (HP during a fight, telegraph visibility) belongs in that follow-up's v1.
2. **Zone Capacity Enforcement** — wire `maxPlayers` from content into an actual `this.maxClients` (or manual join-count rejection) for both room types.
3. (Optional, only if requested) **Spawn Position Staggering** — a small deterministic per-session offset so simultaneous fresh joins don't render exactly stacked.

### Validation

```bash
pnpm --filter @doomscrolls/client typecheck
pnpm --filter @doomscrolls/server typecheck
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No commit made — the working tree was not clean before this session's work began (pre-existing uncommitted work from a prior session), so per standing rule no commit was made.
