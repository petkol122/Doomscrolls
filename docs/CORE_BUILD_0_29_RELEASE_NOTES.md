# docs/CORE_BUILD_0_29_RELEASE_NOTES.md — Core Build 0.29 Release Notes

---

## Task — Room-Local Chat (TownRoom + CombatRoom)

**Date:** 2026-09-07
**Build:** Core Build 0.29
**Status:** Implemented and verified.

### Summary

Players can now talk to each other, live, in whichever TownRoom or CombatRoom instance they're currently in — the first genuinely new communication feature in this project (`PlayerPresence.ts` has said "no chat, no gameplay" since Core 0.1). Unlike 0.27/0.28, there was no existing plumbing to close a gap in: no chat protocol message, schema field, or `room.broadcast()` call existed anywhere. Scope was kept deliberately narrow per the task brief: room-local only (no whispers/DMs/global/channels), pure ephemeral relay (no persistence, no history replay on join), a 240-character length cap, a ~700ms per-session server-side cooldown, and no moderation tooling this pass. Both room types shipped in one build, using a single shared handler — a deliberate break from 0.27/0.28's Town-first sequencing, justified because chat has zero interaction with combat/movement state and so carries none of the risk-stacking concern that motivated splitting those builds.

### What changed

- `packages/shared/src/protocol/ClientMessages.ts` / `ServerMessages.ts` — added `RequestChatClientMessage`, `RequestChatRejectedReason`, `RequestChatRejectedServerMessage`. Replaced the pre-existing but unused `ChatMessageClientMessage`/`ChatMessageServerMessage` stub types (discovered during Wave 2, never wired to any handler, confirmed by repo-wide grep) in place with the properly-scoped shapes rather than adding a second, parallel chat message shape.
- `apps/server/src/realtime/rooms/chatMessageValidation.ts` (new) — pure shape/length validator, mirrors `dodgeIntentValidation.ts`.
- `apps/server/src/realtime/rooms/chatCooldown.ts` (new) — per-session rate limiting via a plain `Map<sessionId, number>`, deliberately kept off the synced `PlayerPresence` schema (no client UI needs to show a chat-cooldown countdown). Exports `clearChatCooldown(sessionId)`, called explicitly from both `TownRoom.onLeave` and `CombatRoom.onLeave` next to the existing `unregisterConnectedPlayer(...)` call — a plain `Map` does not clean itself up on disconnect, and `TownRoom` in particular is never disposed, so this was a real leak risk caught and fixed during planning, not discovered live.
- `apps/server/src/realtime/rooms/chatHandler.ts` (new) — a single shared `registerChatHandler(room, log)`, called from both `TownRoom.onCreate` and `CombatRoom.onCreate`. Unlike `request_dodge`/`request_attack` (each independently implemented per room because they diverge on room-specific combat behavior), chat has no room-specific behavior at all, so one handler serves both rooms. Relays via `room.broadcast("chat_message", ...)` — this codebase's first use of that Colyseus primitive; every prior "everyone in the room finds out" case was schema sync or a targeted `client.send`.
- `apps/client/src/net/chatClient.ts` (new) — `sendChatMessage` / `registerChatMessageListeners`, mirroring `dodgeIntentClient.ts`.
- `apps/client/src/game/scenes/worldSession/worldSessionChatView.ts` (new) — the persistent chat log + input, capped to the last 50 rendered messages, every sender name and message body set via `.textContent` only (never `.innerHTML` — confirmed by grep that no code in this client does that anywhere, and named explicitly as a requirement here since chat is the first player-authored, freely-typed text a third party's client renders).
- `apps/client/src/game/scenes/worldSession/worldSessionOverlayLayout.ts` — added a `chat` grid area (the previously-empty middle-left cell) and `applyWorldSessionOverlayChatStyles`, docking the log bottom-left, above the orb cluster, clear of the corner-menu column.
- `apps/client/src/game/scenes/WorldSessionScene.ts` — wired the new chat region into `createOverlay`, the actual panel-mount call site (not `worldSessionOverlayView.ts`, which builds status/utility/hud panel *content* but isn't where grid regions are created).
- `packages/localization/src/locales/en.ts` — `world_session.chat_input_placeholder`, `world_session.chat_empty`.

### A wrinkle that resolved for free

Question 5 named "input focus stealing world input" (Space/Q/skill-slot hotkeys firing while typing) as a risk to verify during implementation. It turned out already solved: `shouldIgnoreWorldSessionCombatHotkey()` (used by every existing combat hotkey handler) checks `document.activeElement` for any focused `<input>`/`<textarea>`/`<select>`/contenteditable and suppresses hotkeys accordingly. Using a plain `<input>` for chat means this guard covers it automatically — zero new wiring needed.

### Two corrections made during plan review, before implementation

1. **Chat cooldown cleanup.** The original plan claimed the cooldown `Map` "resets for free" on disconnect — false for a plain `Map`. Corrected to follow the exact `connectedPlayerRegistry.ts` `register`/`unregister`-from-`onLeave` precedent. An end-to-end reconnect test was considered to verify this and rejected: Colyseus issues a fresh `sessionId` per connection, so such a test would pass identically whether cleanup is wired up or not. Verified instead with a direct unit test on `chatCooldown.ts`.
2. **Injection safety.** No code in this client uses `innerHTML` anywhere (confirmed by grep), but this wasn't yet stated as a requirement for the new chat view specifically. Made explicit, since `displayName`/message `text` are the first freely-typed player strings rendered to a third party.

### Field-visibility audit

`chat_message` carries exactly `sessionId` (keying only), `displayName`, `text`, `sentAt` — no `classKey`, `level`, or any other `PlayerPresence` field. Unlike 0.27's other-player rendering (which had to whitelist six fields out of ~40 on a shared, wide object), the chat payload is a purpose-built shape with nothing else reachable on it, which structurally rules out a future field silently leaking into chat the way it could for that shared object.

### Non-goals held

- Whispers/DMs, global/lobby chat, channels — room-local broadcast only, proven by a dedicated room-isolation test (server-side and live).
- Persistence/history — pure ephemeral relay; nothing written, nothing replayed on join.
- Profanity filter / moderation tooling — named explicit follow-up, not silently absent.
- Chat commands, rich text, links, emotes, markup, message editing/deletion, read receipts, typing indicators, unread badges — all out of scope for v1.

### Verification — vitest (`apps/server/test/`)

- `apps/server/test/town/chatRelay.test.ts` (4 tests) / `apps/server/test/combat/chatRelay.test.ts` (5 tests, including room isolation across two different `requestedZoneId` room instances) — relay to every client including the sender, empty-message rejection, length-cap rejection, rate-limit rejection.
- `apps/server/test/chatCooldown.test.ts` (4 tests) — direct unit coverage of `isChatReady`/`consumeChatCooldown`/`clearChatCooldown`.

Full suite: 40 files / 71 tests (37/58 baseline + 3 new files / 13 new tests), all green. One of three full-suite runs hit this codebase's documented pre-existing Windows/Prisma teardown flake (`docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md`, ~7% residual rate after that investigation's fix) at a location unrelated to the new chat files; a clean re-run is that document's own standing procedure, and two of three runs passed with zero relation to this build's changes. `pnpm -r typecheck` clean throughout.

### The live two-context Playwright check

Same established procedure as 0.27/0.28: a throwaway Node script (`playwright` installed only in the session scratchpad, never added to the repo) driving the already-running `pnpm dev:all` stack (real Fastify/Colyseus server, real Postgres/Redis, real Vite dev server).

- Two independent browser contexts, each registering a real account and character through the actual UI, both entering Nightmarket.
- **Relay confirmed both directions**: A's message appeared in A's own log immediately (input cleared) and in B's log within ~1.5s with A's correct character name; reversed B→A with the same result.
- **Cooldown confirmed**: two sends fired ~30ms apart (via synthetic events, to genuinely beat the ~700ms cooldown rather than Playwright's own action overhead) — only the first appeared in the log; the second was silently dropped, exactly per the deliberate no-feedback-UI design.
- **CombatRoom port confirmed**: both characters routed into Blackwire Sewers; Debug Panel showed `Room kind: combat`, `Connected players: 2` in both contexts; chat relay repeated successfully both directions.
- **Room isolation confirmed live**: A moved back to Nightmarket while B stayed in combat; B then sent a message, and A's log stayed empty — a live echo of the server-side isolation test.
- Zero console errors in either browser context; zero server-side errors/warnings in the `dev:all` log for the entire run.

Every dimension in the plan's Verification Strategy passed.

### Unrelated finding, noted not fixed

`WorldSessionScene.ts:1088` always passes `undefined` for `onReturnToTown`, making the "Return to Town" button `createCharacterChip` can render dead code in the current build (only "Leave" back to Account Shell is reachable). Found incidentally during the live check; unrelated to chat, not touched by this build, named here for future triage rather than fixed as a side effect.

### Queued follow-ups (named explicitly, as the plan requires)

1. **Profanity filter / moderation tooling** — deferred; a real design surface of its own (word-list vs. service, false positives, moderator tooling), not attempted this pass.
2. **Chat cooldown UI feedback** — currently a silent server-side reject with no dedicated affordance; a small inline hint could be added cheaply if it proves confusing in practice.
3. **Zone capacity enforcement** — still the open 0.27 follow-up, unrelated to and untouched by this build.
4. **`onReturnToTown` dead-code path** — noted above; not a chat concern.

### Validation

```bash
pnpm --filter @doomscrolls/server typecheck
pnpm -r typecheck
pnpm --filter @doomscrolls/server test
```

No commit made yet — pending user request, per standing rule.
