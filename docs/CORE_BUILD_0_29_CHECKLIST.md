# docs/CORE_BUILD_0_29_CHECKLIST.md — Core Build 0.29 Checklist

---

## Core 0.29 Planning Open Checklist

**Date:** 2026-09-07
**Build:** Core Build 0.29
**Theme:** Room-Local Chat — TownRoom + CombatRoom
**Status:** Implemented and verified. Plan approved; Waves 2-5 completed in this session (shared protocol, server relay, client UI, 13 new tests, live two-context Playwright check across both room types). See `docs/CORE_BUILD_0_29_RELEASE_NOTES.md` for full detail.

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_29_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_29_CHECKLIST.md`
- [x] Confirm no chat protocol message, schema field, or broadcast mechanism exists anywhere today (grep across `apps/server/src/realtime`, `packages/shared/src/protocol`)
- [x] Confirm `room.broadcast()` is never called anywhere in this codebase — every existing "whole room finds out" case is schema sync or a targeted `client.send` — and flag this as new ground rather than an established pattern being reused
- [x] Find and quote `docs/CODING_RULES.md`'s Realtime Room File-Size Guard, which already names "chat" explicitly as a concern that must not accumulate in room files, pre-emptively (written before any chat feature existed)
- [x] Confirm `PlayerPresence.ts`'s original "no chat, no gameplay" doc comment and 0.27's non-goals reconfirmation, establishing this as the first build to pick chat up
- [x] Confirm `TownRoom`/`CombatRoom` have no shared base class, and that every existing intent (`request_dodge`/`request_attack`/`request_move`) is independently registered per room because each has room-specific behavior to diverge on
- [x] Audit the exact `request_dodge` idiom end to end (shared-package client/server message interfaces, a pure shape validator module, a cooldown module, a thin room-registered handler, a client-side `send*Intent`/`register*ResponseListeners` pair) as the template to mirror for chat
- [x] Decide room scope: room-local only, both TownRoom and CombatRoom in one pass — explicitly reasoned against 0.27/0.28's Town-first sequencing rather than copying it by default (Question 1)
- [x] Decide persistence: pure ephemeral relay, no DB, no history replay on join (Question 2)
- [x] Decide abuse protection: 240-char length cap, ~700ms server-side-only per-session cooldown (deliberately kept off the synced `PlayerPresence` schema, unlike dodge/attack), profanity filtering named as an explicit deferred follow-up (Question 3)
- [x] Correct an initial planning error: the server-side cooldown `Map` does not clean itself up on disconnect; found and applied the existing `connectedPlayerRegistry.ts` `register`/`unregister`-from-`onLeave` precedent instead of the original hand-wave (Question 3)
- [x] Confirm no `innerHTML` usage exists anywhere in the client, and name `.textContent`/`.setText`-only rendering as an explicit requirement for the new chat view rather than an assumed default (Question 5)
- [x] Decide protocol shape: `request_chat` / `request_chat_rejected` / `chat_message`, mirroring `RequestDodgeClientMessage`'s exact shape and rejection-reason idiom; decided against a separate `request_chat_accepted` in favor of the sender receiving its own broadcast (Question 4)
- [x] Audit the current HUD grid (`worldSessionOverlayLayout.ts`) region by region (`status`, `utility`, `hud`) and identify the unused middle-left cell as the chat dock location, sketched as a one-line grid-template-areas change (Question 5)
- [x] Decide the chat log is always-visible (not an icon-flyout toggle like Objectives/Inventory), reasoned explicitly against that pattern rather than defaulted to it, since a live feed being hideable would need its own unread-state design
- [x] Run the same per-field visibility audit 0.27 applied to `PlayerPresence` against the new `chat_message` payload; decide `displayName`/`text`/`sentAt` are shown, `classKey`/`level` are withheld, and note the payload is a purpose-built shape rather than a `PlayerPresenceEntry` slice, which structurally rules out future field leakage (Question 6)
- [x] Confirm the existing Vitest two-real-client harness (`createTestRealtimeServer`, `waitForMessage`, `fixtures`) needs no changes and is directly reusable for chat relay/rate-limit/rejection assertions
- [x] Identify room isolation (a message sent in one room instance must not reach a client in a different instance) as new verification ground not covered by any existing test, and design a specific test case for it
- [x] Confirm Playwright remains uninstalled in this repo; design the two-context live check as a scratchpad-only script per the established 0.27/0.28 procedure, extended to cover both room types
- [x] Define candidate task waves
- [x] Define explicit 0.29 non-goals
- [x] Define the 0.29 risk list, each with why it's accepted or how it's mitigated
- [x] Name queued follow-ups explicitly (profanity/moderation tooling; chat-cooldown UI feedback), not as vague "later" items
- [ ] Get this plan reviewed/approved before starting Wave 2

### Core 0.29 Scope Guardrails (for implementation, once approved)

- [ ] No chat message history/persistence is added anywhere — no DB table, no migration, no replay-on-join
- [ ] No whispers/DMs, global chat, or channels — room-local broadcast only, enforced by the room-isolation test
- [ ] No profanity filter or moderation tooling this pass — named as a deferred follow-up
- [ ] `chat_message` carries only `sessionId` (key-only), `displayName`, `text`, `sentAt` — no `classKey`, `level`, or any other `PlayerPresence` field
- [ ] Chat cooldown state stays server-side only (a plain `Map`, not a synced schema field) — not added to `PlayerPresence.ts`
- [ ] Chat cooldown `Map` entries are explicitly deleted via `clearChatCooldown(sessionId)`, called from both `TownRoom.onLeave` and `CombatRoom.onLeave` next to the existing `unregisterConnectedPlayer(...)` call — not left to "reset for free"
- [ ] Every chat-view DOM/Phaser text write uses `.textContent`/`.setText`, never `.innerHTML` or an equivalent markup-parsing assignment
- [ ] `TownRoom.ts`/`CombatRoom.ts` only gain a registration call each — validator, cooldown, and handler logic live in separate helper modules per the file-size guard rule
- [ ] Both room types are covered by the new tests before any live check is attempted (per 0.28's "prove it per room, don't just assume the port" discipline)
- [ ] A live two-context Playwright check (scratchpad script, not a repo dependency) is performed for both TownRoom and CombatRoom, and its outcome reported, not assumed

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.29 scope documents
- [x] Reconfirm the current full server test suite as the regression baseline 0.29 must not break (37 files / 58 tests, all passing before and after Wave 2)

#### Wave 2 — Shared Protocol + Server Relay

- [x] `packages/shared/src/protocol/ClientMessages.ts`: add `RequestChatClientMessage` (replaced the unused `ChatMessageClientMessage` stub, which was never wired to any handler)
- [x] `packages/shared/src/protocol/ServerMessages.ts`: add `RequestChatRejectedReason`, `RequestChatRejectedServerMessage`; replace the unused `ChatMessageServerMessage` stub's shape (`fromCharacterId` → `sessionId`/`displayName`/`sentAt`, per Question 6's field-visibility audit)
- [x] New `apps/server/src/realtime/rooms/chatMessageValidation.ts`
- [x] New `apps/server/src/realtime/rooms/chatCooldown.ts`, including `clearChatCooldown(sessionId)`
- [x] New `apps/server/src/realtime/rooms/chatHandler.ts` (single shared `registerChatHandler`)
- [x] Wire `registerChatHandler` into `TownRoom.onCreate` and `CombatRoom.onCreate`
- [x] Add `clearChatCooldown(client.sessionId)` to `TownRoom.onLeave` and `CombatRoom.onLeave`, next to the existing `unregisterConnectedPlayer(...)` call
- [x] `pnpm --filter @doomscrolls/server typecheck` clean
- [x] `pnpm -r typecheck` clean (full monorepo, confirms no client code referenced the old stub types)
- [x] `pnpm --filter @doomscrolls/server test` — full existing suite green (37 files / 58 tests), no regressions

#### Wave 3 — Client UI

- [x] New `apps/client/src/net/chatClient.ts` (`sendChatMessage` / `registerChatMessageListeners`)
- [x] `worldSessionOverlayLayout.ts`: new `chat` grid area + `applyWorldSessionOverlayChatStyles`
- [x] New `worldSessionChatView.ts` (log + input, capped in-memory history to 50 messages, D2-style scrim treatment, `.textContent`-only rendering)
- [x] Wire the chat panel into `WorldSessionScene.ts`'s existing overlay region assembly (the actual panel-mount call site — `worldSessionOverlayView.ts` builds the status/utility/hud panel *content*, but `WorldSessionScene.createOverlay` is where grid regions are created and populated, so that's the wiring point this item actually meant)
- [x] Confirmed the existing `shouldIgnoreWorldSessionCombatHotkey()` guard (already used by dodge/flask/skill-slot hotkeys) covers the chat `<input>` automatically via `document.activeElement` — no new keyboard-focus wiring needed for the "input focus stealing world input" wrinkle named in the plan
- [x] Added `world_session.chat_input_placeholder` / `world_session.chat_empty` localization keys
- [x] `pnpm -r typecheck` clean

#### Wave 4 — Verification (priority)

- [x] `apps/server/test/town/chatRelay.test.ts`: relay, length cap, empty-message rejection, rate limit, sender receives own broadcast (4 tests)
- [x] `apps/server/test/combat/chatRelay.test.ts`: same coverage, proving the shared handler actually works in CombatRoom, not just by inspection (5 tests)
- [x] Room-isolation test (in the CombatRoom file): a message sent in one `requestedZoneId` room instance does not reach a client in a different-zone room instance, confirmed via `.filterBy` producing distinct `roomId`s
- [x] Unit test on `chatCooldown.ts` directly (`apps/server/test/chatCooldown.test.ts`, 4 tests): consume → not ready → `clearChatCooldown` → ready again (an end-to-end reconnect test was considered and rejected — Colyseus issues a fresh `sessionId` per connection, so it would pass identically whether cleanup is wired up or not)
- [x] Full existing suite stays green (40 files / 71 tests: 37/58 baseline + 3 new files / 13 new tests). One run of three crashed with the documented pre-existing Windows/Prisma teardown flake (`docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md`, ~7% residual rate) at a location unrelated to the new chat files; a clean re-run is that doc's own documented procedure, and two of three runs passed cleanly with zero relation to the chat changes
- [x] `pnpm -r typecheck` clean (a first run after this wave caught 4 unsafe-cast errors in the new test files — `as Record<string, unknown>` needs `as unknown as Record<string, unknown>` for a type with no index signature; fixed and reconfirmed clean)

#### Wave 5 — Live Check and Docs

- [x] Two Playwright browser contexts (scratchpad script via `npx`/scratchpad `npm install playwright`, no repo dependency added), two real accounts, both in Nightmarket — message sent A→B and B→A, screenshot-confirmed, correct character name shown, no class/level label
- [x] Rapid double-send from one context confirms the second is silently dropped (cooldown), not duplicated
- [x] Both characters routed into Blackwire Sewers (combat); chat repeated there to confirm the CombatRoom port, Debug Panel confirmed `roomKind: combat`, `connectedPlayerCount: 2`
- [x] One context leaves to a different room (Nightmarket) while the other stays in combat; confirmed the departed context's log stayed empty when the remaining context sent a message — live echo of the room-isolation test
- [x] Zero console errors in either browser context; zero server-side errors/warnings in the `dev:all` log for the whole run
- [x] Write `docs/CORE_BUILD_0_29_RELEASE_NOTES.md`
- [x] Full `pnpm -r typecheck` and `pnpm --filter @doomscrolls/server test` pass
- [ ] Commit only if the working tree is already clean, per standing rule (not yet requested)

### Explicit Non-Goals / Deferred Items

- [x] Whispers / direct messages
- [x] Global chat / lobby chat / channels
- [x] Chat history / persistence / DB storage
- [x] Profanity filter / moderation tooling / reporting (named explicit follow-up)
- [x] Chat commands, rich text, links, emotes, markup
- [x] Message editing or deletion
- [x] Read receipts / typing indicators / unread badges
- [x] Exposing `classKey`, `level`, or any other `PlayerPresence` field beyond `displayName` in the chat payload

### Planning Exit Criteria

- [x] Core Build 0.29 has a clear theme grounded in a direct audit of the existing protocol/broadcast/room-registration patterns, not assumed from prior builds
- [x] The build framing correctly identifies this as genuinely new ground (no prior chat plumbing to port), unlike 0.27/0.28
- [x] The room-scope question (Town-first vs. both rooms) was answered with an explicit case distinguishing it from 0.27/0.28's sequencing reasoning, not defaulted to copying it
- [x] The persistence question was answered with an explicit ephemeral recommendation and rationale, not assumed
- [x] Abuse protection (length cap + rate limit) has a concrete, codebase-consistent design, with profanity filtering explicitly named as deferred rather than silently absent
- [x] The protocol section mirrors an existing, proven intent pattern (`request_dodge`) end to end rather than inventing a new shape
- [x] The UI section sketches the actual current grid layout with file:line grounding and proposes a concrete, collision-free placement, not a vague "add a chat box somewhere"
- [x] The field-visibility question was answered with an explicit per-field call, following 0.27's audit discipline, rather than assumed safe because "it's just a name"
- [x] Core Build 0.29 has grouped candidate waves
- [x] Core Build 0.29 has explicit non-goals
- [x] Core Build 0.29 has an explicit risk list
- [x] Core Build 0.29 has a verification strategy covering new server-side relay/rate-limit/room-isolation tests and a concretely-designed two-context live check across both room types
- [x] Plan reviewed and approved by the user
- [x] Implementation completed: Waves 2-5 done, all vitest coverage green (40 files / 71 tests), live two-context Playwright check passed on every dimension in both room types, release notes written
