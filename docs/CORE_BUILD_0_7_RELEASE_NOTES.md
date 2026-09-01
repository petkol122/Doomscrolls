# docs/CORE_BUILD_0_7_RELEASE_NOTES.md — Core Build 0.7 Release Notes

---

## Core 0.7 Planning Opened

**Date:** 2026-09-01
**Build:** Core Build 0.7
**Status:** Planning open, then implemented same day (Task 360)
**Previous Build State:** Core Build 0.6 is now treated as RC / bugfix-only

### Summary

Core Build 0.7 is the **Itemization Payoff** build. Its job was to finally close a gap explicitly deferred in both 0.5 (Task 357) and 0.6 (Task 359): a third loot rarity tier had twice been declined for lack of item variety, not for lack of a mechanism. 0.7 designs and ships enough new weapon/armor items to give a third tier (`epic`) real, obtainable population across both combat zones' loot tables, and — since scope allowed — also ships one small new skill.

Planning docs: `docs/CORE_BUILD_0_7_PLAN.md`, `docs/CORE_BUILD_0_7_CHECKLIST.md`.

---

## Task 360 — Epic Rarity Tier, Six New Items, and the Bone Splinter Skill (Waves 2-5)

**Date:** 2026-09-01
**Status:** Implemented and verified

### Summary

Implemented Waves 2-5 of the 0.7 plan in one pass: added the `epic` rarity tier and six new weapon/armor items to populate it across all four existing loot tables, extended client-side rarity presentation to a third tier, and added a new skill (Bone Splinter) on a new tertiary skill slot — which required generalizing the previously fully-hardcoded secondary skill slot ("Grave Spark") onto content, and registering skill-slot handling in `CombatRoom.ts` for the first time (it previously only existed in `TownRoom.ts`, meaning no skill could be cast in either real combat zone).

### What changed — Items and Rarity Tier

- **`packages/content/src/data/types.ts`**: `ItemRarity` extended to `"common" | "rare" | "epic"`.
- **`packages/content/src/data/items.ts`**: added six new epic items, each with a `statModifiers` combination that did not exist on any prior item — `condemned_cleaver` (weapon, +7 dmg/+70ms cooldown), `warden_plate` (chest, +5 armor/+15 hp), `scavenger_king_helm` (head, +3 armor/+2 toughness) for the Blackwire-family identity; `livewire_lance` (weapon, +4 dmg/-70ms cooldown), `chargeplate_vest` (chest, +3 mind/+0.12 moveSpeed/+1 armor), `static_wraps` (hands, -70ms cooldown/+0.12 moveSpeed) for the Static Yard-family identity.
- **`packages/content/src/data/lootTables.ts`**: added epic entries to all four existing loot tables (`sewer_starter_loot`, `sewer_brute_loot`, `sewer_skitter_loot` share the three Blackwire-family epic items, mirroring how they already share `rustbound_ring` as their `rare` entry; `static_yard_loot` gets its own three Static Yard-family epic items, mirroring its own distinct `rare` entry). Epic weights (0.4-0.6) sit meaningfully below existing `rare` weights (1-2); `LootTableEntryDefinition.weight` has no integer constraint, and the server's `pickWeighted` roller is a cumulative-sum float picker, confirmed by simulation to handle fractional weights correctly.
- **`packages/content/src/ContentValidation.ts`**: added validation for the new `CharacterClassContentDefinition.secondarySkillId`/`tertiarySkillId` fields (see skill section below).
- **`packages/localization/src/locales/en.ts`** and **`LocaleTypes.ts`**: added all 12 required item localization keys plus the new skill's keys.
- The six new items are deliberately **not** added to `vendorStocks.ts` — epic items are drop-only, unlike the common slot-coverage items added in Task 356.

### What changed — Client Rarity Presentation

- **`worldSessionLootPlaceholderView.ts`**: added an `epic` branch (purple, `#c77dff` family) to `getItemRarityColor`, `getItemRarityStrokeColor`, and the ground-loot glow/ping/body color palette function (a third rarity color mapping in this file, beyond the two the plan had already identified).
- **`worldSessionEquipmentView.ts`**: added the same `epic` branch to its `getItemRarityColor`.
- **`worldSessionOverlayView.ts`**: found and fixed a fourth rarity color mapping pair not identified in planning — the item-detail panel's `getItemRarityColor`/`getItemRarityAccentColor` — extended both with an `epic` branch.
- **`worldSessionAreaView.ts`**: generalized the client's hardcoded `graveSparkRange = 96` display constant to read from `contentRegistry.skills.get("grave_spark")?.range` instead, so the client-side range hint can't silently drift from the skill's actual content-driven range.

### What changed — New Skill (Bone Splinter) and the Skill-Slot Generalization

The audit in the 0.7 plan found that the game's only existing skill, "Grave Spark," was implemented as three hardcoded constants (`GRAVE_SPARK_RANGE/DAMAGE/COOLDOWN_MS`) duplicated in `TownRoom.ts` and `deferredActionExecution.ts`, entirely outside the `skills.ts` content registry — and that `request_use_skill_slot` was registered **only** in `TownRoom.ts`. `CombatRoom.ts` had no skill-slot handler at all, so no skill could be cast in Blackwire Sewers or Static Yard, the game's only real combat zones. Adding a second skill without addressing this would have shipped a fake feature.

- **`packages/content/src/data/skills.ts`**: added `grave_spark` (range 96, cooldown 1500ms, damage 3 — lifted verbatim from the old hardcoded constants) and `bone_splinter` (range 140, cooldown 2600ms, damage 5 — longer range and a harder hit than Grave Spark, at a slower cadence).
- **`packages/content/src/data/classes.ts`** / **`types.ts`**: `CharacterClassContentDefinition` gained `secondarySkillId`/`tertiarySkillId` fields; `gravewalker` maps `secondary → grave_spark`, `tertiary → bone_splinter`.
- **`apps/server/src/realtime/rooms/skillSlotContent.ts`** (new): a small content-lookup module — `resolveSkillSlotDefinition(slot)` resolves range/damage/cooldown from `skills.ts` via the class's slot mapping; `getSkillSlotCooldownAt`/`setSkillSlotCooldownAt` read/write the correct `PlayerPresence` cooldown field per slot; `pendingActionTypeForSkillSlot`/`skillSlotForPendingActionType` bridge the two slot ids to TownRoom's deferred-action-queue type strings.
- **`apps/server/src/realtime/rooms/PlayerPresence.ts`**: added `nextTertiarySkillSlotAt`, an independent cooldown field from the existing `nextSkillSlotAt` (secondary), so the two skills don't share a cooldown.
- **`apps/server/src/realtime/rooms/pendingActionState.ts`**: added `"skill_tertiary"` to `PendingActionType`.
- **`apps/server/src/realtime/rooms/TownRoom.ts`**: generalized `registerSkillSlotHandler` to accept either slot instead of rejecting anything but `"secondary"`; removed the `GRAVE_SPARK_*` constants entirely in favor of `resolveSkillSlotDefinition`.
- **`apps/server/src/realtime/rooms/deferredActionExecution.ts`**: generalized both `skill_secondary`-only code paths (the deferred move-then-cast guard and execution blocks) to handle either slot via the same content lookup; removed its own separate copy of the `GRAVE_SPARK_*` constants.
- **`apps/server/src/realtime/rooms/CombatRoom.ts`**: added `registerSkillSlotHandler`, mirroring the existing `registerAttackHandler` pattern exactly (immediate accept/reject, no deferred move-closer queue — CombatRoom's basic attack doesn't auto-approach either, unlike TownRoom's).
- **`packages/shared/src/protocol/ClientMessages.ts`** / **`ServerMessages.ts`**: widened the `slot` field from the literal `"secondary"` to `"secondary" | "tertiary"` on all three skill-slot messages.
- **`apps/client/src/net/skillSlotIntentClient.ts`**: `sendSkillSlotIntent` now takes a `slot` parameter; its accepted/rejected type guards accept either slot.
- **`apps/client/src/game/scenes/worldSession/worldSessionSkillTertiaryInput.ts`** (new): the tertiary skill's client input module, mirroring the existing dodge/flask input modules (`worldSessionDodgeInput.ts`, `worldSessionHealingFlaskInput.ts`) — a small, self-contained module owning the "E" keyboard hotkey, targeting whichever enemy is already hovered/selected for the secondary slot's targeting hint, with transient feedback notices rather than a second persistent HUD cooldown card. It does not register its own Colyseus message listener (a second registration for the same message type would conflict with the existing one); `WorldSessionScene.ts`'s existing `registerSkillSlotResponseListeners` call now branches on `message.slot` and routes tertiary-slot responses into this module's `handleAccepted`/`handleRejected`.
- **`WorldSessionScene.ts`**: wired the new input module's lifecycle (attach/destroy alongside dodge/flask) and the response-routing branch above.
- **`worldSessionOverlayView.ts`**: added an `"E (enemy)"` entry to the controls legend.

### Decision: no fourth rarity tier

Not evaluated for this build — the plan scoped exactly one new tier (`epic`), and that scope was held.

### Unplanned finding, fixed: `CombatRoom` join never read persisted character stats

While live-verifying the new skill, every attempt was rejected with `player_downed` even for a healthy character. Root cause: `CombatRoom.onJoin` (in `buildCombatPlayerPresence`'s call site) hardcoded `hp: 0, maxHp: 0, movementSpeed: 0, attackCooldownMs: 0` for every fresh join, instead of reading `result.character.stats` the way `TownRoom.onJoin` already correctly does. This silently blocked *any* alive-gated action — basic attack included, not just the new skill — for a fresh combat-zone join, and predates this build entirely (unrelated to Core 0.7's own changes). Fixed by mirroring `TownRoom.ts`'s existing resolution (`resolvePlayerMovementSpeed`, `resolveAttackCooldownMs`, and the same `maxHp`/`currentHp` derivation) exactly. Confirmed via a live scripted test that failed with `player_downed` before the fix and passed cleanly — casting both skills successfully in both zones — after it.

### Unplanned finding, not fixed: `CombatRoom` has no zone-based matchmaking filter

Also discovered during live verification: `CombatRoom` is registered with Colyseus via a plain `realtimeServer.define(COMBAT_ROOM_NAME, CombatRoom)`, with no `.filterBy(["zoneId"])` or equivalent. `client.joinOrCreate("combat", { requestedZoneId })` can therefore silently reuse an already-open combat room of a *different* zone rather than creating/joining the one actually requested — reproduced directly: a `static_yard` join request landed in an already-open `blackwire_sewers` room, complete with that room's partially-damaged enemy. This only manifests when a combat room for one zone is already open and a join for a different zone arrives (e.g. multiple players, or reconnect timing); it is unrelated to this build's own scope and was **not** fixed here — it's a separate, real matchmaking-layer gap worth a dedicated follow-up task.

### Verification

- `pnpm typecheck` — 0 errors across all 5 workspace packages (localization, shared, content, client, server).
- Server boot log confirms `"Content registry validation succeeded."` against the full new content set (6 items, 2 skills, 4 updated loot tables, extended class definition).
- Live end-to-end verification via a scripted Colyseus client (no browser-automation tooling was available in this environment, so this substitutes for a manual browser pass on the server-authoritative logic — the highest-risk part of this build): registered a temp account, created a character, joined a **freshly-created** `combat` room (via `client.create`, sidestepping the matchmaking gap above) for both `blackwire_sewers` and `static_yard`, confirmed the correct per-zone enemy roster in each (`trashboar_runt` vs. `static_wretch`), then cast both `secondary` (Grave Spark, 3 damage) and `tertiary` (Bone Splinter, 5 damage) successfully against a live enemy in **both** zones, confirmed an immediate secondary re-cast was correctly rejected with `skill_on_cooldown` while tertiary remained independently castable, and confirmed damage/remaining-HP tracked correctly through to enemy defeat.
- Simulated 20,000 loot rolls per table against the real `rollLootTable`/`pickWeighted` implementation: every epic item across all four tables lands consistently in the ~0.3-0.5% range (vs. ~1-2% for existing `rare` entries), never zero — confirming the third tier is genuinely obtainable, not "dead" the way the two prior declined attempts would have been.
- Temp verification scripts and the temp test accounts/characters (including all cascaded rows) were removed from the dev database after testing.

---

## Task 361 — Hotfix: CombatRoom Zone-Id Matchmaking Filter

**Date:** 2026-09-01
**Status:** Implemented and verified

### Summary

Fixed the matchmaking gap found (and left open) during Task 360's verification: `CombatRoom` was registered with Colyseus via a plain `realtimeServer.define(COMBAT_ROOM_NAME, CombatRoom)`, with no filter on zone id. `client.joinOrCreate("combat", { requestedZoneId })` could therefore silently reuse an already-open combat room of a *different* zone instead of creating/joining the one actually requested.

### What changed

- **`apps/server/src/realtime/createRealtimeServer.ts`**: added `.filterBy(["requestedZoneId"])` to the `CombatRoom` registration. `requestedZoneId` is the same join-option field name already used end-to-end for zone resolution (`CombatRoom.onCreate`, `RoomJoinValidationService`, `RealtimeClient.ts`) — no new option or naming convention was introduced. Colyseus's matchmaker (`@colyseus/core`'s `RegisteredHandler.filterBy`) uses this to (a) only match an existing room whose metadata carries the same `requestedZoneId`, and (b) automatically stamp that value onto a newly-created room's metadata, both handled by the existing `getFilterOptions`/`getMetadataFromOptions` machinery — no other code needed to change. `TownRoom` was left as-is: it has only one town-classified zone (Nightmarket) today, so it has no equivalent matchmaking ambiguity to fix.

### Verification

- `pnpm typecheck` — 0 errors across all 5 workspace packages.
- Live scripted reproduction of the original bug scenario, now passing: two Colyseus clients called `joinOrCreate("combat", ...)` **concurrently**, one requesting `blackwire_sewers` and the other `static_yard`. Each landed in a distinct room whose synced `state.zoneId` matched what it requested, with the correct zone-specific enemy roster (`trashboar_runt` vs. `static_wretch`). A third client then requested `blackwire_sewers` again and correctly **reused** the first client's existing room (same `roomId`), confirming the filter narrows matchmaking without breaking legitimate multiplayer room-sharing within a zone.
- Re-ran (not from scratch) the Task 360 skill-cast checks through the now-fixed `joinOrCreate` path (previously only spot-checked via `client.create`, which sidesteps matchmaking entirely): both `secondary` (Grave Spark, 3 dmg) and `tertiary` (Bone Splinter, 5 dmg) cast successfully against a live enemy in both zones.
- Temp verification script and temp test accounts (3 more, cascading) were removed from the dev database after testing.
