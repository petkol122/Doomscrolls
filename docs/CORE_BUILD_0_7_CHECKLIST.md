# docs/CORE_BUILD_0_7_CHECKLIST.md — Core Build 0.7 Checklist

---

## Core 0.7 Planning Open Checklist

**Date:** 2026-09-01
**Build:** Core Build 0.7
**Theme:** Itemization Payoff — the Third Rarity Tier
**Status:** Waves 1-5 implemented and verified in one pass (Task 360), plus a same-day hotfix (Task 361). All 6 new epic items, the new rarity tier, and the new tertiary skill are live-verified server-side; client-side rarity color changes are verified by code inspection only (no browser tooling was available in this environment). Two unplanned pre-existing bugs were found during verification and both are now fixed: `CombatRoom` join hardcoding hp/moveSpeed to 0 (Task 360), and `CombatRoom` having no zone-id matchmaking filter (Task 361).

### Planning Deliverables

- [x] Create `docs/CORE_BUILD_0_7_PLAN.md`
- [x] Create `docs/CORE_BUILD_0_7_CHECKLIST.md`
- [x] Define Core Build 0.7 theme
- [x] Define Core Build 0.7 goal
- [x] Audit current item/loot/rarity/skill state as the plan's factual baseline
- [x] Define Core Build 0.7 feature pillars
- [x] Define candidate task waves
- [x] Define explicit 0.7 non-goals
- [x] Define the 0.7 risk list
- [x] Define the recommended implementation order

### Core 0.7 Scope Guardrails

- [x] 0.7 is explicitly framed as building on the shipped 0.6 loop (Nightmarket → Blackwire Sewers / Static Yard → loot/XP/objectives → return)
- [x] New items reuse the exact `ItemContentDefinition` shape — no new `ItemCategory` or `EquipmentSlot` values
- [x] New items are weapon/armor only, each with a `statModifiers` combination distinct from every existing item
- [x] Exactly one new rarity tier (`epic`) is added — no fourth tier
- [x] Epic items are drop-only — not added to `vendorStocks.ts`
- [x] No affix system, no rolled/randomized item stats
- [x] Existing `common`/`rare` loot entries are not removed, renamed, or deliberately reweighted (only new epic rows are added)
- [x] New skill (if pursued) stays a single-target, single-slot addition — no skill points, talent trees, or loadout selection UI
- [x] If the skill pillar is cut, the discovered CombatRoom skill-slot gap (Grave Spark unusable outside Nightmarket) is explicitly recorded as open tech debt, not silently dropped

### Candidate Wave Checklist

#### Wave 1 — Planning

- [x] Finalize 0.7 scope documents
- [x] Reconfirm the 0.6 loop as the stable baseline 0.7 must not break

#### Wave 2 — Item Content and Rarity Tier (priority)

- [x] Extend `ItemRarity` to `"common" | "rare" | "epic"` in `packages/content/src/data/types.ts`
- [x] Add `condemned_cleaver` (weapon), `warden_plate` (chest), `scavenger_king_helm` (head) — Blackwire-family epic items
- [x] Add `livewire_lance` (weapon), `chargeplate_vest` (chest), `static_wraps` (hands) — Static Yard-family epic items
- [x] Add all 12 required localization keys (`item.<id>.name` / `.description`) to `en.ts` and `LocaleTypes.ts`
- [x] Add epic entries (shared Blackwire-family pool, brute weighted slightly higher) to `sewer_starter_loot`, `sewer_brute_loot`, `sewer_skitter_loot`
- [x] Add epic entries (Static Yard-family pool) to `static_yard_loot`
- [x] Set epic weights meaningfully below existing `rare` weights in each table
- [x] Confirm the six new items are **not** added to `vendorStocks.ts`

#### Wave 3 — Client Rarity Presentation

- [x] Extend `getItemRarityColor` / `getItemRarityStrokeColor` in `worldSessionLootPlaceholderView.ts` with an `epic` branch
- [x] Extend `getItemRarityColor` in `worldSessionEquipmentView.ts` with the same `epic` branch/color
- [x] Sweep `worldSessionOverlayView.ts`, `WorldSessionScene.ts`, `worldSessionAreaView.ts`, `worldSessionFeedbackView.ts`, `townRoomWorldLoot.ts`, `pickupWorldLootClient.ts` for any other hardcoded `rarity === "rare"` branch and extend it — found and fixed two more beyond the plan's known two: `worldSessionOverlayView.ts`'s item-detail-panel `getItemRarityColor`/`getItemRarityAccentColor` (a third, separate rarity color pair)
- [x] Verified by code inspection, not a live browser session (no browser-automation tooling was available in this environment): epic branch added consistently across all 4 client color-mapping functions found
- [x] Verified by code inspection: equipped-item rarity color path (`worldSessionEquipmentView.ts`) covers epic the same way
- [ ] Not verified: Task 358's gear-comparison affordance against the six new items in an actual browser session — deferred, see note below

#### Wave 4 — New Skill (optional, cut first)

- [x] Add the new skill's `SkillContentDefinition` to `skills.ts`
- [x] Generalize the hardcoded `GRAVE_SPARK_*` constants (`TownRoom.ts`, `deferredActionExecution.ts`) into a content lookup keyed off `skills.ts`
- [x] Register the (now content-driven) skill-slot handler in `CombatRoom.ts`, reusing the same damage/loot/objective/XP call pattern as `request_attack`
- [x] Add the new skill's own slot: client keybind, HUD cooldown display, new `PlayerPresence` cooldown field
- [x] Not cut — Bone Splinter shipped. The CombatRoom skill-slot gap that would have been left as tech debt is instead closed directly (`registerSkillSlotHandler` added to `CombatRoom.ts`)

#### Wave 5 — Polish and RC Closure

- [x] Live server-side verification (scripted Colyseus client, not a browser — no browser-automation tooling was available in this environment): registered a temp account, created a character, joined a fresh `combat` room for both `blackwire_sewers` and `static_yard`, and confirmed the correct per-zone enemy roster (`trashboar_runt` vs `static_wretch`)
- [x] Confirmed epic-tier loot is genuinely obtainable and not "dead": simulated 20,000 rolls per loot table against the real `rollLootTable`/`pickWeighted` implementation — every epic item lands consistently in the ~0.3-0.5% range across all 4 tables (vs. ~1-2% for `rare`), never zero, and the picker handles the fractional epic weights (0.4-0.6) correctly (it's a cumulative-sum float picker, not integer-based)
- [ ] Not verified: epic loot's in-world visual color/glow in an actual browser session — deferred, see note below
- [x] Confirmed vendor stock is unaffected (verified by inspection — the six new items are absent from `vendorStocks.ts`)
- [x] Confirmed the new skill is castable in both Blackwire Sewers and Static Yard, not just Nightmarket: live-tested `secondary` (Grave Spark, 3 dmg) and `tertiary` (Bone Splinter, 5 dmg) in both zones via the real `request_use_skill_slot` message path, including independent per-slot cooldown enforcement (an immediate secondary re-cast was correctly rejected with `skill_on_cooldown` while tertiary remained castable)
- [x] `pnpm typecheck` passes across all workspace packages
- [x] Server boot confirms `Content registry validation succeeded` against the new items/skills/loot tables
- [x] Found and fixed an unplanned but necessary bug during verification: `CombatRoom.onJoin` hardcoded `hp: 0, maxHp: 0, movementSpeed: 0, attackCooldownMs: 0` for every fresh join instead of reading the character's persisted stats (unlike `TownRoom.onJoin`, which already did this correctly) — this silently blocked *any* alive-gated action (attack, dodge, skill) for a fresh combat-zone join, pre-dating this build. Fixed by mirroring `TownRoom.ts`'s existing resolution exactly; confirmed via the live skill test above, which failed with `player_downed` before the fix and passed cleanly after
- [x] **Fixed (Task 361 hotfix, same day):** `CombatRoom` had no Colyseus matchmaking filter on zone id, so `client.joinOrCreate("combat", { requestedZoneId })` could silently reuse an already-open combat room of a *different* zone. Fixed with `.filterBy(["requestedZoneId"])` on the room registration in `createRealtimeServer.ts`. Live-reproduced and re-verified fixed: two concurrent `joinOrCreate` calls for different zones now land in distinct, correctly-zoned rooms, while a third request for an already-open zone correctly reuses that room. See `docs/CORE_BUILD_0_7_RELEASE_NOTES.md`'s Task 361 entry.
- [x] Cleaned up: temp verification scripts and temp test accounts/characters removed after testing (accounts deleted from the dev Postgres instance, cascading to all dependent rows)
- [x] Close toward controlled 0.7 RC / bugfix-only state for the shipped waves; the two deferred/found items above remain explicitly open

### Explicit Non-Goals / Deferred Items

- [ ] No new equipment slot types
- [ ] No crafting / enchanting / affix rolling / randomized item stats
- [ ] No fourth rarity tier
- [ ] No new town/hub zone, region/kraj, or world-map travel system
- [ ] No skill points, talent trees, or multi-skill loadout/selection UI
- [ ] No new AI state machine, ranged/projectile enemies, or group-aggro mechanics
- [ ] No new class/origin content
- [ ] No full economy (auction house, trading, restock timers)
- [ ] No Vue / app-shell migration
- [ ] No pets / mounts / familiars
- [ ] No professions, housing, guilds, PvP
- [ ] No rebalancing of existing common/rare loot entries beyond additive dilution

### Planning Exit Criteria

- [x] Core Build 0.7 has a clear theme
- [x] Core Build 0.7 has a clear goal grounded in the actual current item/loot/rarity/skill state
- [x] Core Build 0.7 has defined feature pillars
- [x] Core Build 0.7 has grouped candidate waves
- [x] Core Build 0.7 has explicit non-goals
- [x] Core Build 0.7 has an explicit risk list
- [x] Core Build 0.6 is clearly treated as RC / bugfix-only baseline
- [x] The next implementation task can be selected directly from the plan (Wave 2 — Item Content and Rarity Tier)
