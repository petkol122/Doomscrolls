# docs/CORE_BUILD_0_29_PLAN.md — Core Build 0.29 Plan

## Status

**Implemented and verified.** All five waves complete: shared protocol, server relay, client UI, new vitest coverage (13 tests across 3 new files), and a live two-context Playwright check passing on every dimension in both room types. See `docs/CORE_BUILD_0_29_RELEASE_NOTES.md` for full detail. Plan reviewed and approved; two corrections made during implementation review (chat cooldown cleanup on disconnect, explicit `.textContent`-only rendering requirement — see Question 3 and Question 5, both amended in place with the original hand-waved claims struck and replaced). One further discovery made during Wave 2 itself: `packages/shared/src/protocol/{ClientMessages,ServerMessages}.ts` already contained unused `ChatMessageClientMessage`/`ChatMessageServerMessage` stub types (never wired to any handler, confirmed by repo-wide grep) predating this build. These were replaced in place with the properly-scoped `RequestChatClientMessage`/`ChatMessageServerMessage`/`RequestChatRejectedServerMessage` shapes described below, rather than adding a second, parallel chat message shape — safe because nothing referenced the old names (confirmed by `pnpm -r typecheck`).

Wave 3 confirmed the existing `shouldIgnoreWorldSessionCombatHotkey()` guard (already used by dodge/flask/skill-slot hotkeys, gating on `document.activeElement`) covers the new chat `<input>` automatically — the "input focus stealing world input" wrinkle named in Question 5 resolved with zero new code.

Wave 4 added `apps/server/test/town/chatRelay.test.ts` (4 tests), `apps/server/test/combat/chatRelay.test.ts` (5 tests, including room isolation), and `apps/server/test/chatCooldown.test.ts` (4 tests, a direct unit test rather than the rejected end-to-end reconnect approach). Full suite: 40 files / 71 tests green. One of three full-suite runs hit this codebase's documented pre-existing Windows/Prisma teardown flake (`docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md`, ~7% residual rate after that investigation's fix) at a location unrelated to the new chat files; a clean re-run is that document's own standing procedure, and two of three runs passed with no relation to this build's changes. `pnpm -r typecheck` is clean throughout.

Wave 5's live two-context Playwright check (same scratchpad-only procedure as 0.27/0.28) passed on every dimension: relay both directions in TownRoom with correct sender names, cooldown-drop of a rapid second send, the CombatRoom port confirmed live in Blackwire Sewers, and room isolation confirmed live (a departed session's log stayed empty when the remaining session kept chatting). Zero console or server errors observed. One unrelated, pre-existing dead-code finding (`WorldSessionScene.ts:1088`'s `onReturnToTown` always `undefined`) surfaced incidentally and is named, not fixed. See `docs/CORE_BUILD_0_29_RELEASE_NOTES.md` for full detail.

---

## Core 0.29 Theme

**Room-Local Chat — TownRoom + CombatRoom**

The first genuinely new communication feature in this project. Unlike 0.27/0.28 (which closed a client-rendering gap over data that already existed and already synced), there is nothing to port or reuse here: no chat protocol message, no chat schema field, and no `room.broadcast()` call exist anywhere in the codebase today (confirmed by grep across `apps/server/src/realtime`). `PlayerPresence.ts`'s own doc comment has said "no chat, no gameplay" since Core 0.1, and 0.27's non-goals reconfirmed it explicitly ("chat / any player-to-player communication — was never in scope for `PlayerPresence` and stays that way"). 0.29 is the build that finally picks it up, on the strength of 0.27/0.28 having proven other players are now visible in both room types.

---

## Build Framing — Current State

**There is no broadcast-to-everyone primitive in use yet.** Every existing "the whole room finds out" mechanism is actually one of two things: (1) Colyseus schema auto-sync — mutating a field on the `MapSchema<PlayerPresence>` replicates to every client automatically, which is how presence/position/HP updates reach everyone; or (2) a targeted `client.send(type, payload)` to exactly one player (rejections, `equipment_updated`). Nowhere does the code call `this.broadcast(...)` or loop `this.clients` to send the same message to every connected client. Chat is the first feature that actually needs that — "everyone currently in the room sees it" is not a side effect of state sync (a chat message isn't a piece of persistent per-player state), it's a real broadcast. This plan proposes the first use of Colyseus's own `room.broadcast()` primitive, which is exactly what it's for — flagged here as new ground for this codebase, not hidden inside a room file.

**`docs/CODING_RULES.md` already names chat by name, pre-emptively**, in the Realtime Room File-Size Guard section: "Room files must not accumulate gameplay, map, movement, pathing, combat, AI, loot, XP, inventory, equipment, corpse behavior, **chat**, networking serialization, networking deserialization or UI logic" (`docs/CODING_RULES.md:365`). That rule was written before any chat feature existed, which means the extraction discipline below (validator + cooldown + handler as separate helper modules, `TownRoom.ts`/`CombatRoom.ts` only wiring them up) has to be followed from the first line of new code, not retrofitted after the fact — matching how `request_dodge`/`request_attack`/`request_move` are already split into a shape-validator module, a cooldown module, and a thin room-registered handler.

**Two rooms, no shared base class.** `TownRoom` and `CombatRoom` both extend Colyseus's `Room` directly (`apps/server/src/realtime/rooms/TownRoom.ts:671`, `apps/server/src/realtime/rooms/CombatRoom.ts:304`); every existing intent (`request_dodge`, `request_attack`, `request_move`) is independently registered in *both* rooms via near-identical `registerXHandler` methods, because each one has room-specific behavior to diverge on (combat telegraphs, retaliation, zone rules). Chat has **no** room-specific behavior — a chat message means exactly the same thing in Nightmarket as it does in Blackwire Sewers. That makes it a better candidate for a single shared handler function than dodge/attack ever were (see Question 1).

---

## Question 1 — Scope: Room-Local, Both Room Types, in One Pass

**Decided: room-local only (everyone currently joined to your specific `TownRoom`/`CombatRoom` instance), and — breaking from 0.27/0.28's "Town first, Combat as a named follow-up" sequencing — shipped in both room types in this same build.** No whispers/DMs, no global chat, no channels this pass; nothing in the brief or the current design calls for cross-room delivery, and adding any of them would be exactly the kind of "default to full-featured chat system" the task explicitly warned against.

**Why both rooms now, unlike 0.27/0.28's Town-first split:** that sequencing existed because CombatRoom's own gameplay (multi-enemy aggro, retaliation, dodge-vs-telegraph timing) had just gone live for the first time in 0.24, and stacking a second never-jointly-verified surface (other-player rendering) on top of it risked an ambiguous live-check result. Chat has **zero interaction with combat, movement, or any gameplay state** — it is pure text relay, gated only by shape/length/cooldown. There is no shared mutable state for a chat bug to corrupt, and no combat-timing surface for a chat bug to destabilize. The risk-stacking argument that justified splitting 0.27/0.28 doesn't transfer here, so shipping both rooms in one pass is a deliberate call, not an oversight — verified per-room anyway (see Verification) exactly because "already correct by construction" was 0.28's lesson: prove it per room type, don't just assume the port.

---

## Question 2 — Persistence: Ephemeral, No DB

**Decided: pure ephemeral relay.** A message is broadcast live to whoever is currently in the room and then gone — no chat-message table, no migration, no history replay on join, no server-side log retained beyond what's needed to relay it once. A player who joins mid-conversation sees nothing before their join, exactly like real-time voice in the same room; this matches "room-local" framing directly (the room, not an account, is the unit of scope, so there's nothing to attach durable history to that would still make sense after everyone leaves).

Client-side, the chat log is an in-memory list (capped, e.g. last 50 messages) held only for the lifetime of the current room session — cleared on leaving the room (return-to-town, disconnect, or death→respawn if that re-joins a room), not written to `localStorage`. This avoids all schema/migration work for a first pass, as recommended, and keeps the feature's blast radius entirely inside the realtime layer.

---

## Question 3 — Abuse Protection

**Length cap: 240 characters**, server-enforced (client sends whatever it wants; server truncation is not attempted — over-length is a hard reject, matching the existing "reject, don't silently mutate" convention used by every other validator). Empty or whitespace-only messages after trim are also rejected (`empty_message`).

**Rate limiting: a fixed per-message cooldown, modeled on the existing `nextDodgeAt`/`nextAttackAt` timestamp pattern** (`apps/server/src/realtime/rooms/dodgeCooldown.ts`) — but held **server-side only, not on the synced `PlayerPresence` schema**. Every existing cooldown lives on `PlayerPresence` because the client's own HUD needs to show it (a dodge-ready ring, an attack-cooldown bar). Chat cooldown has no such UI — a player who's mid-cooldown just can't send yet, matching how the existing rejection idiom already surfaces a reason to the sender only. Putting it on `PlayerPresence` would grow a schema whose every field 0.27 already had to explicitly audit for third-party visibility, for a value nobody but the room needs. Proposed shape: a small `chatCooldown.ts` module (mirroring `dodgeCooldown.ts`'s two-function shape) backed by a plain `Map<sessionId, number>`, not `Schema`/`@type`.

**Correction from an earlier draft of this plan: the Map does *not* clean itself up on disconnect** — nothing about a client leaving automatically removes an entry from a plain `Map`. This needs the exact same explicit teardown this codebase already uses for the structurally identical problem: `connectedPlayerRegistry.ts` is a module-level `Map` with a `register`/`unregister` pair, and `unregisterConnectedPlayer` is called explicitly from both `TownRoom.onLeave` (`TownRoom.ts:1017`) and `CombatRoom.onLeave` (`CombatRoom.ts:571`), including a sessionId-ownership guard (`existing.client.sessionId === client.sessionId`) so a stale unregister can't clobber a newer session that reused the same key. `chatCooldown.ts` needs the same shape — `recordChatMessage(sessionId, now)` / `clearChatCooldown(sessionId)` — with `clearChatCooldown` called explicitly from both rooms' existing `onLeave` overrides. Without this, `TownRoom` in particular (long-lived, never disposed, reused across every player who ever visits Nightmarket) would leak one Map entry per player who ever sent a chat message, for the life of the server process. This is corrected here rather than left as the original hand-wave.

Proposed cooldown: **~700ms between messages** per player — generous enough that a real person typing and hitting Enter never notices it, tight enough to stop a script or held-Enter key from flooding the room. Rejection reply: `request_chat_rejected` with `reason: "chat_on_cooldown"`, following the exact `request_dodge_rejected`/`request_attack_rejected` reply shape.

**No profanity filter or moderation tooling this pass** — named explicitly as a deferred follow-up (Queued Follow-Ups below), not silently absent. It's out of scope here because it's a real design surface of its own (word-list vs. external service, false-positive handling, moderator tooling/reporting) that the brief didn't ask for and that would meaningfully grow this build.

---

## Question 4 — Protocol

Follows the exact `request_dodge` idiom end to end:

**`packages/shared/src/protocol/ClientMessages.ts`** — new interface, added to the existing discriminated union:
```ts
export interface RequestChatClientMessage {
  readonly type: "request_chat";
  readonly text: string;
}
```

**`packages/shared/src/protocol/ServerMessages.ts`** — mirrors `RequestDodgeRejectedReason`/`RequestDodgeAcceptedServerMessage`/`RequestDodgeRejectedServerMessage` exactly:
```ts
export type RequestChatRejectedReason =
  | "invalid_shape"
  | "empty_message"
  | "message_too_long"
  | "chat_on_cooldown";

export interface RequestChatRejectedServerMessage {
  readonly type: "request_chat_rejected";
  readonly reason: RequestChatRejectedReason;
}

export interface ChatMessageServerMessage {
  readonly type: "chat_message";
  readonly sessionId: string;
  readonly displayName: string;
  readonly text: string;
  readonly sentAt: number;
}
```
No `request_chat_accepted` — the broadcast `chat_message` the sender also receives (see Question 6) doubles as the accept signal, so a separate accept message would be redundant, unlike dodge (whose accept carries no payload but still confirms the action happened before the player's own client sees any world effect).

**New server-side helper modules** (per the file-size guard rule quoted above — nothing added inline to `TownRoom.ts`/`CombatRoom.ts` beyond registration):
- `apps/server/src/realtime/rooms/chatMessageValidation.ts` — pure shape/length validator, mirrors `dodgeIntentValidation.ts`: checks `type === "request_chat"`, `typeof text === "string"`, trims, checks `0 < length <= 240`. Does **not** know about cooldown or room membership — same separation of concerns as `validateDodgeIntent`.
- `apps/server/src/realtime/rooms/chatCooldown.ts` — `isChatReady(sessionId, now)` / `consumeChatCooldown(sessionId, now)` pair backed by the in-memory `Map`, per Question 3 — **plus `clearChatCooldown(sessionId)`**, mirroring `connectedPlayerRegistry.ts`'s `unregisterConnectedPlayer` shape exactly. A plain `Map` does not clean itself up when a client disconnects; this export exists specifically so both rooms' `onLeave` can delete the entry explicitly (see below), the same way `unregisterConnectedPlayer` already is.
- `apps/server/src/realtime/rooms/chatHandler.ts` — **one shared `registerChatHandler(room, getPresence, log)` function**, called from both `TownRoom.onCreate` and `CombatRoom.onCreate`, per the Build Framing argument that chat has no room-specific behavior to diverge on. Internally: `room.onMessage("request_chat", (client, raw) => {...})` → resolve the sender's `PlayerPresence` (reject `invalid_shape`-style if not found, matching the existing "player not found → warn+return" idiom) → `validateChatMessage` → `isChatReady` → on success, `consumeChatCooldown` then `room.broadcast("chat_message", { sessionId: client.sessionId, displayName: player.displayName, text, sentAt: Date.now() })`; on any failure, `client.send("request_chat_rejected", { reason })` wrapped in the existing `try {} catch {}` idiom. Each room still gets its own `chatHandlerRegistered` guard flag at the call site, matching the existing double-registration guard convention.
- **`TownRoom.onLeave` (`TownRoom.ts:1009`) and `CombatRoom.onLeave` each gain one additional line**, `clearChatCooldown(client.sessionId)`, placed next to the existing `unregisterConnectedPlayer(...)` call already made there — the exact same explicit per-session teardown this codebase already uses for the structurally identical problem, not a new pattern.

**Client side** — `apps/client/src/net/chatClient.ts`, mirroring `dodgeIntentClient.ts`: `sendChatMessage(room, text)` (checks `room`/`connection.isOpen`, trims, rejects empty/over-length client-side as a cheap early UX guard — the server remains the sole authority) and `registerChatMessageListeners(room, { onMessage, onRejected })` with the same runtime type-guard pattern as `isRequestDodgeAcceptedServerMessage`.

---

## Question 5 — UI: A Persistent Floating Chat Log, Not a Debug Panel

**Current screen layout** (`apps/client/src/game/scenes/worldSession/worldSessionOverlayLayout.ts:8-10`), a CSS Grid DOM overlay (`position:fixed; inset:0`) over the Phaser canvas — not Phaser game objects:
```
grid-template-columns: minmax(0, 1fr) auto;
grid-template-rows:    auto            minmax(0, 1fr)   auto;
grid-template-areas:   "status utility"
                        ".      utility"
                        "hud    hud";
```
- **`status`** (top-left) — character panel.
- **`utility`** (top-right, spans both non-`hud` rows) — the Core 0.25 corner icon toolbar (Controls / Objectives / Equipment / Stats / Inventory), each a click-to-open flyout anchored off its own icon.
- **`hud`** (bottom, full-width grid row, but its *panel* is `justifySelf: center` at `min(760px, 100vw-32px)`) — the orb/belt cluster.
- The **middle-left cell (`.`)** is entirely unused today — open space below the character panel, above the orb cluster, to the left of the corner-menu column. The bottom row also has genuinely empty space to the left and right of the centered orb cluster, since the `hud` panel itself is narrower than the row it occupies.

**Proposed placement: dock the chat log to that open middle-left cell, bottom-anchored, so it sits directly above the orb cluster in the bottom-left corner** — the same corner classic ARPGs (D2, PoE) use for chat, and it collides with nothing: the corner-menu column is entirely on the right, and the orb cluster is horizontally centered. One-line template change:
```
grid-template-areas: "status utility"
                      "chat   utility"
                      "hud    hud";
```
with a new `applyWorldSessionOverlayChatStyles(panel)` (in `worldSessionOverlayLayout.ts`, alongside the existing `applyWorldSessionOverlay*Styles` functions) setting `gridArea: "chat"`, `alignSelf: "end"`, `justifySelf: "start"`, a capped width (e.g. `min(320px, 100vw-28px)`) and a capped height (e.g. `max-height: 220px` with internal `overflow-y: auto`) — the same sizing idiom already used for `status`/`hud`.

**Visual treatment**: matches the established D2-style HUD language already in this codebase, not the corner-menu's bordered flyout-card look (`applyWorldSessionOverlayPanelStyles`'s `1px solid #4d3f2a` card border) and not a debug-style monospace box. Reuse the semi-transparent, borderless-but-legible treatment `applyWorldSessionOverlayFloatingHudStyles` already established for the orb cluster (Core 0.25: "floats directly over the game world with no visible container... must stay visually invisible") — the chat log itself gets a soft dark gradient scrim behind the text (so it reads over any background) rather than a hard-edged panel, with a slim single-line input row anchored to its bottom edge, styled consistent with the item-panel gradient/border treatment (`applyWorldSessionOverlayItemPanelStyles`) rather than a plain HTML `<input>` default.

**Always visible, not an icon-flyout toggle.** The corner-menu's `<details>`/flyout pattern fits static info panels (objectives, equipment) that a player checks occasionally. A chat log is a *live feed* — genre convention (and basic usability) keeps it persistently on screen so a message isn't missed while the panel is closed. This also sidesteps needing an unread-message badge/notification state, which would be a real (if small) design surface of its own if the log could be hidden.

**Input focus**: clicking the input row or pressing a dedicated key (e.g. `Enter`) focuses it; while focused, keystrokes must not fall through to any world hotkey. Movement in this project is click-to-move (no WASD), so the collision surface is small, but this needs an explicit check against whatever keyboard handling exists (e.g. Escape-to-close on other panels) during implementation — named here as a wrinkle to verify, not assumed away.

**Text rendering must stay injection-safe by the same convention already used everywhere else in this codebase.** Confirmed by grep: `innerHTML` is never used anywhere under `apps/client/src` today. Every existing DOM text write uses `.textContent = ...` (e.g. `accountShellDom.ts`), and every existing Phaser label uses `.setText(...)` (e.g. `worldSessionPlayerPlaceholderView.ts:127`, `infoText.setText(nextText)`) — neither parses its input as markup, so both `displayName` and message `text` are already safe by construction if the new chat view follows the same idiom. This is stated here as an explicit requirement for `worldSessionChatView.ts` — each rendered message line and the sender name must be set via `.textContent`, never via a template string assigned to `.innerHTML` — rather than assumed safe as a side effect of "the rest of the codebase happens to do it that way."

---

## Question 6 — Field-Visibility Discipline

Following the exact per-field audit discipline 0.27 introduced for `PlayerPresence` (`docs/CORE_BUILD_0_27_PLAN.md`'s Question 2a table), applied to the new `chat_message` payload:

| Field | Classify | Reasoning |
|---|---|---|
| `sessionId` | Internal/keying only | Needed to de-duplicate/color the sender's own messages differently client-side; never rendered as content |
| `displayName` | **Show, as the speaker's name** | Already established as public by 0.27's audit ("Display name is public"); this is the whole point of a chat log — showing *who* said something |
| `text` | **Show** | The message itself |
| `sentAt` | **Show** | Timestamp for ordering/display (e.g. a relative "just now"), not sensitive |
| `classKey` | **Withhold** | 0.27 only ever exposed class as a *tint color* on a rendered placeholder, never as a text/label value. Chat is a text surface — putting `[Ironclad] PlayerName: text` in the log would be a new kind of exposure (class-as-label) that was explicitly not what 0.27 approved, not a neutral default |
| `level` | **Withhold** | 0.27 explicitly withheld level ("progression stats... not in the task's explicit fine list"); nothing about chat changes that call |
| `characterId`, `hp`/`maxHp`, or any other `PlayerPresence` field | **Not applicable** | The chat payload is a purpose-built message shape (Question 4), not a pass-through of `PlayerPresenceEntry` — there is no path for these to leak in even accidentally, unlike the 0.27 case where the same object legitimately needed every field for the *local* HUD |

**Resulting rule, made explicit at the call site (not left implicit): `chat_message` carries exactly `sessionId`, `displayName`, `text`, `sentAt` — no class, no level, no position, no combat state.** Because this is a new, narrow message shape rather than a slice of an existing wide object, there's no risk of a future field being added to `PlayerPresence` and silently leaking into chat the way it could for the other-player renderer — worth noting as a structural advantage of Question 4's design over reusing `PlayerPresenceEntry`.

---

## Proposed Implementation Approach (for review, not yet executed)

**New shared-package types, new server helper modules + two-room wiring, new client helper + one new grid area.**

1. `packages/shared/src/protocol/ClientMessages.ts` — `RequestChatClientMessage`, added to the client-message union.
2. `packages/shared/src/protocol/ServerMessages.ts` — `RequestChatRejectedReason`, `RequestChatRejectedServerMessage`, `ChatMessageServerMessage`, both added to the server-message union.
3. `apps/server/src/realtime/rooms/chatMessageValidation.ts` — pure shape/length validator (Question 4).
4. `apps/server/src/realtime/rooms/chatCooldown.ts` — in-memory per-session cooldown, with an explicit `clearChatCooldown(sessionId)` export (Question 3).
5. `apps/server/src/realtime/rooms/chatHandler.ts` — shared `registerChatHandler(room, ...)`, called once from `TownRoom.onCreate` and once from `CombatRoom.onCreate` (two one-line call sites + guard flags, no duplicated logic).
6. `TownRoom.onLeave` / `CombatRoom.onLeave` — one added line each, `clearChatCooldown(client.sessionId)`, next to the existing `unregisterConnectedPlayer(...)` call (Question 3).
7. `apps/client/src/net/chatClient.ts` — `sendChatMessage` / `registerChatMessageListeners` (Question 4).
8. `apps/client/src/game/scenes/worldSession/worldSessionOverlayLayout.ts` — new `chat` grid area + `applyWorldSessionOverlayChatStyles` (Question 5).
9. New view module, e.g. `apps/client/src/game/scenes/worldSession/worldSessionChatView.ts` — builds the log + input DOM, owns the capped in-memory message list, wires `sendChatMessage`/`registerChatMessageListeners`, and renders every sender name / message line via `.textContent` only, never `.innerHTML` (Question 5) — mirrors how `worldSessionEquipmentView.ts`/`worldSessionOverlayView.ts` split concerns rather than growing one file further.
10. Wherever `worldSessionOverlayView`'s root/update function assembles panels (same call site that already appends `statusPanel`/`utilityPanel`/`hudPanel`) — append the new chat panel and thread the room reference through, following the existing `update(character, room, ...)` signature shape.

No changes to `PlayerPresence.ts`, `TownRoomState.ts`, `CombatRoomState.ts`, or any movement/combat logic — chat is additive and orthogonal to all existing schema and gameplay code.

---

## Verification Strategy

### New Vitest coverage — both room types, per 0.28's "prove it per room, don't just assume the port" discipline

Two new files, `apps/server/test/town/chatRelay.test.ts` and `apps/server/test/combat/chatRelay.test.ts`, both following the `multiPlayerPresenceVisibility.test.ts` two-real-client structure (`createTestRealtimeServer`, `waitForMessage`, `fixtures`):

- **Relay**: two real clients join the same room; client A sends `request_chat` with valid text; assert client B receives `chat_message` (via `waitForMessage`) with the correct `sessionId`/`displayName`/`text`, and that it carries none of the withheld fields (Question 6). Assert the sender also receives its own `chat_message` broadcast (Question 4's "no separate accept" design).
- **Length cap**: over-240-char text → sender receives `request_chat_rejected` with `reason: "message_too_long"`; the other client receives nothing.
- **Empty message**: whitespace-only text → `empty_message` rejection, no broadcast.
- **Rate limit**: two rapid `request_chat` sends from the same client within the cooldown window → first succeeds, second is rejected with `chat_on_cooldown`; after waiting out the cooldown, a third succeeds.
- **Room isolation** (new verification ground, not covered by any existing test): a client in one `CombatRoom` instance (zone A) sends a message; a client in a *different* `CombatRoom` instance (zone B, or the same zone but a second room after `maxClients`/matchmaking separation) must **not** receive it — proves "room-local" is actually enforced, not just assumed from "well, `broadcast()` only hits `this.clients`."
- **Cooldown cleanup, as a targeted unit test, not an integration test**: a separate `apps/server/test/support`-style unit test directly against `chatCooldown.ts` (`consumeChatCooldown(id, now)` → `isChatReady(id, now)` is `false` → `clearChatCooldown(id)` → `isChatReady(id, now)` is `true` again). An end-to-end reconnect test was considered and **rejected** — Colyseus assigns every connection a fresh `sessionId`, so a client that disconnects and rejoins gets a new Map key regardless of whether the old entry was ever cleared; a test built that way would pass identically whether `clearChatCooldown` is wired into `onLeave` or not, and would silently prove nothing. Whether the one-line `clearChatCooldown(client.sessionId)` call actually lands inside `onLeave` (Question 3 / Proposed Implementation step 6) is a small, easily-diffable change reviewed at code-review time, next to the existing `unregisterConnectedPlayer` call it mirrors — not something worth an elaborate behavioral test to catch a missed line.

### Live two-context check — the only way to prove a second client sees a message

Per this project's established (but not repo-installed) technique: a throwaway two-`browser.newContext()` Playwright script run from the session scratchpad against `pnpm dev:all`, **not added as a repo dependency** — identical procedure to 0.27/0.28.

1. Two contexts, two real accounts, both enter Nightmarket (same `TownRoom`, guaranteed per the no-`.filterBy` finding from 0.27's plan).
2. Context A types and sends a message; screenshot context B showing the message appear in its chat log with A's display name, no class/level label.
3. Reverse direction (B → A).
4. Send a message rapidly twice from one context; confirm the second attempt is visibly rejected/no-ops rather than silently duplicating, and a normal-paced third message goes through.
5. Route both characters into the same combat zone (Blackwire Sewers, same technique as 0.28); repeat step 2 in CombatRoom to confirm the port actually works live, not just in Vitest.
6. (Optional, cheap to add) leave one context back to town while the other stays in combat; send a message from the remaining context; confirm the departed context (now in a different room) does not receive it — a live echo of the room-isolation Vitest case.

**Gates:** `pnpm --filter @doomscrolls/server typecheck`, `pnpm -r typecheck`, `pnpm --filter @doomscrolls/server test` must all pass. No commit unless the working tree is already clean.

---

## Core 0.29 Non-Goals

```text
whispers / direct messages -- no per-player targeting this pass; room-local broadcast only
global chat / lobby chat / channels -- no cross-room delivery of any kind
chat history / persistence / DB storage -- ephemeral relay only (Question 2); nothing written, nothing replayed on join
profanity filter / moderation tooling / reporting -- named explicit follow-up, not silently absent
chat commands (e.g. "/who", "/party") -- plain text messages only
rich text, links, emotes, markup of any kind -- plain trimmed text, length-capped
message editing or deletion -- a sent message cannot be recalled or changed
read receipts / typing indicators / unread badges -- log is always visible (Question 5), so "unread" isn't a state that exists
exposing classKey, level, or any other PlayerPresence field beyond displayName in the chat payload -- Question 6
```

---

## Candidate Task Waves

### Wave 1 — Planning
- [x] This document
- [x] Protocol scope decided (Question 4), field-visibility audit done (Question 6) before any code

### Wave 2 — Shared Protocol + Server Relay
- [ ] `ClientMessages.ts` / `ServerMessages.ts` additions
- [ ] `chatMessageValidation.ts`, `chatCooldown.ts`, `chatHandler.ts`
- [ ] Wire `registerChatHandler` into `TownRoom.onCreate` and `CombatRoom.onCreate`

### Wave 3 — Client UI
- [ ] `chatClient.ts`
- [ ] New `chat` grid area + `applyWorldSessionOverlayChatStyles`
- [ ] `worldSessionChatView.ts` (log + input, capped in-memory history)
- [ ] Wire into `worldSessionOverlayView.ts`'s panel assembly

### Wave 4 — Verification (priority)
- [ ] `apps/server/test/town/chatRelay.test.ts`, `apps/server/test/combat/chatRelay.test.ts` (relay, length cap, rate limit, room isolation)
- [ ] Full existing suite stays green
- [ ] `pnpm -r typecheck` clean

### Wave 5 — Live Check and Docs
- [ ] Two-context Playwright live check per the Verification Strategy above, both room types, outcome reported (not assumed)
- [ ] `docs/CORE_BUILD_0_29_RELEASE_NOTES.md`

---

## Queued Follow-Ups

1. **Profanity filter / moderation tooling** — named explicitly in Question 3/Non-Goals as deferred, not forgotten.
2. **Chat cooldown UI feedback** — currently proposed as a silent server-side reject with no dedicated client affordance beyond "message didn't appear"; a small inline "sending too fast" hint could be added cheaply later if it proves confusing in the live check.
3. **Zone capacity enforcement** — still the open 0.27 follow-up, unaffected by and unrelated to this build.

---

## Risks

1. **First use of `room.broadcast()` in this codebase.** Low risk technically (it's a standard, well-understood Colyseus primitive) but worth flagging since every prior "everyone in the room finds out" case so far was schema-sync or a manual per-client loop, not this. Verified directly by the room-isolation test (it does only reach `this.clients` on the calling room, not other instances).
2. **Shared handler across two rooms with different state schema types (`TownRoomState` vs `CombatRoomState`)** — the existing dodge/attack code already deals with this via structural casts where needed (`CombatRoom.ts:705-710`). Chat's handler only ever touches `PlayerPresence` fields common to both, so this should be mechanical, but it's the one place implementation may need a type-level workaround, named here rather than discovered as a surprise.
3. **Input focus stealing world input.** Named as a wrinkle in Question 5; needs an explicit check against existing keyboard handling during implementation, not assumed safe because movement is click-to-move.
4. **Always-visible log adds permanent screen real estate in the bottom-left.** Mitigated by capping width/height and using the same semi-transparent, borderless treatment as the orb cluster so it doesn't read as a hard UI wall; worth a specific look during the live check for any collision with gameplay visibility (e.g. does it ever sit over something a player needs to click).
5. **Server-side chat cooldown `Map` leaking memory if `onLeave` cleanup is missed.** An earlier draft of this plan incorrectly assumed the Map "resets for free" on disconnect — it doesn't; a plain `Map` never removes an entry on its own. Corrected: `clearChatCooldown(sessionId)` must be called explicitly from both `TownRoom.onLeave` and `CombatRoom.onLeave`, mirroring the existing `unregisterConnectedPlayer` call already made there for the identical class of problem. `TownRoom` is the case that actually matters — it's never disposed and is reused across every player who ever visits Nightmarket, so a missed cleanup call there is a slow, real, unbounded leak, not a cosmetic one.
6. **Chat text must never reach the DOM via `innerHTML`.** No code in this codebase does that today (confirmed by grep — every DOM write uses `.textContent`, every Phaser label uses `.setText`), but `displayName` and message `text` are the first *player-authored, freely-typed* strings a third party's client will render, unlike existing content (numbers, content-authored labels, or names that are set once at character creation and rarely revisited). Named as an explicit requirement for `worldSessionChatView.ts` (Question 5 / Proposed Implementation step 9) rather than assumed safe by ambient codebase convention alone.

---

## Summary

Chat is a genuinely new capability with no existing plumbing to build on, but it also has none of 0.27/0.28's coupling to gameplay state — that lets 0.29 do something those builds deliberately didn't: ship both room types in one pass, using a single shared handler instead of the room-specific implementations dodge/attack/move needed. Scope is deliberately narrow (room-local, ephemeral, plain text, length-capped and cooldown-gated, no moderation tooling) per the task brief's explicit steer away from a full-featured system. The chat payload is a purpose-built shape carrying only `displayName`/`text`/`sentAt` rather than a slice of the wide `PlayerPresence` object, which structurally rules out the kind of accidental field leakage 0.27 had to audit for by hand. The one real new technical surface is this project's first use of Colyseus's `broadcast()` primitive and its first two-real-client Vitest coverage proving room *isolation* (not just room membership) — both called out explicitly rather than assumed safe.
