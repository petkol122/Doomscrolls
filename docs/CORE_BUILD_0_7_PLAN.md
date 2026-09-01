# docs/CORE_BUILD_0_7_PLAN.md — Core Build 0.7 Plan

## Status

**Planning phase.** Core Build 0.6 shipped Waves 1-4 as Task 359 (routing generalization + Static Yard, the second combat zone) and is now the stable baseline. Core Build 0.7 planning begins as the next scoped build.

No runtime code changes, gameplay implementation, schema changes, or UI implementation are part of this planning task.

---

## Core 0.7 Theme

**Itemization Payoff — the Third Rarity Tier**

---

## Core 0.7 Goal

Close the gap that has blocked a third loot rarity tier for two builds in a row:

- Task 357 (0.5) declined a third tier — no items existed to populate it.
- Task 359 (0.6) re-evaluated and declined again for the same reason — Static Yard's loot table reused only existing items.

Both decisions were correct calls at the time (shipping an empty tier is a fake feature under `AGENTS.md`'s "no fake features" rule), but the underlying gap — not enough distinct items to give a third tier real population — has now gone unaddressed for two consecutive builds. 0.7's job is to finally close it: design and add enough new weapon/armor items, with stat profiles genuinely distinct from what exists today, to populate a third tier across **both** combat zones' loot tables (Blackwire Sewers' three tables and Static Yard's table).

If scope allows after the item work is solid, 0.7 also adds one small new skill. This is explicitly secondary — **if anything gets cut, it is the skill, not the items.**

---

## Build Framing — Current Item/Loot/Skill State (audited 2026-09-01)

This is what actually exists in the codebase today, not aspirational:

- **`ItemRarity` is a two-value union** (`packages/content/src/data/types.ts:23`): `"common" | "rare"`. There is no third tier defined anywhere in the type system.
- **11 items exist today** (`packages/content/src/data/items.ts`): 1 weapon (`starter_pipe`, flat `damage +3`), 4 armor pieces each with exactly **one** stat modifier (`sewer_jacket`: armor+2/hp+5 is the only multi-stat item; `scavenged_hood` armor+1; `sewer_treads` moveSpeed+0.15; `scrapcord_belt` toughness+1), 2 accessories (`rustbound_ring` armor+1/hp+8, `signal_scarred_amulet` mind+2), 1 flask, 1 pair of hands armor (`wraptape_gloves`, attackCooldownMs -40), and 3 stackable materials/currency. Every combat-relevant item is single-purpose; nothing currently combines offense + utility on one item.
- **4 loot tables exist** (`packages/content/src/data/lootTables.ts`): `sewer_starter_loot`, `sewer_brute_loot`, `sewer_skitter_loot` (all three share the same `rustbound_ring` as their sole `rare` entry, weight 1-2), and `static_yard_loot` (its own `rare`, `signal_scarred_amulet`, weight 2). No table has ever had a rarity tier above `rare`.
- **Rarity is untyped past the content layer.** `WorldLoot.rarity`, `EquippedItemSummary.rarity`, and every protocol message carrying rarity are typed as plain `string` (`packages/shared/src/room/WorldLootTypes.ts:19`, `ServerMessages.ts:336`, `CharacterTypes.ts:33`, `InventoryTypes.ts:29`). Server-side pickup/spawn/persistence code (`spawnWorldLootOnEnemyDefeat.ts`, `pickupWorldLootValidation.ts`, `characterMapper.ts`) passes rarity through generically — **a third tier requires zero protocol or schema changes**, only new content plus client display work.
- **Client rarity display is a two-branch `if`, in exactly two places**: `getItemRarityColor`/`getItemRarityStrokeColor` in `worldSessionLootPlaceholderView.ts` (world-loot color/glow, rare = `#8fc7ff`) and `getItemRarityColor` in `worldSessionEquipmentView.ts` (equipped-item panel text color). Both currently fall through anything that isn't `"rare"` to the common color — a new tier is invisible to players until these are extended.
- **`validateContentRegistry` has no rarity allowlist.** It only checks that a loot entry's declared `rarity` (if present) matches the referenced item's own `rarity` field. Adding a new `ItemRarity` value is a pure type-level and content-level change with no validation-rule updates required.
- **Vendor stock (`vendorStocks.ts`) currently mirrors every common item added for slot coverage** (Task 356) as a guaranteed purchase path. No rare item has ever been added to vendor stock.
- **The skill system has a significant, previously-undiscovered gap.** Exactly one skill is castable today — "Grave Spark" — and it is implemented as three hardcoded constants (`GRAVE_SPARK_RANGE`, `GRAVE_SPARK_DAMAGE`, `GRAVE_SPARK_COOLDOWN_MS`) duplicated verbatim in both `TownRoom.ts` and `deferredActionExecution.ts`, entirely outside the `skills.ts` content registry. `skills.ts` itself contains exactly one entry, `heavy_strike`, which is referenced only by `classes.ts`'s `startingSkillId` field and `ContentValidation.ts`'s existence check — it is never read by any damage calculation. **More importantly: `request_use_skill_slot` is registered only in `TownRoom.ts`. `CombatRoom.ts` has no skill-slot handler at all.** Grave Spark cannot currently be cast in Blackwire Sewers or Static Yard — the game's only two real combat zones. It only works in Nightmarket, the town/test-hybrid room. This means the one skill the game has today is, for practical combat purposes, non-functional where combat actually happens.

Core 0.7 should answer:

> Itemization has been "waiting for enough items" for two builds. What does the game look like once that's no longer true?

---

## Major Feature Pillars

### 1. New Items — Weapon and Armor, Distinct Stat Profiles

**Goal:** Add enough new weapon/armor items, each with a stat profile that doesn't exist anywhere in the current 11-item pool, to give a third rarity tier real, intentional population in both combat zones.

Candidate item list (6 items, split evenly across the two zones' established identities — Blackwire's heavy/toughness lean from 0.1-0.6 vs. Static Yard's speed/utility/mind lean from Task 359):

**Blackwire family (heavy, high-damage, toughness):**

| id | slot | statModifiers | why it's distinct |
|---|---|---|---|
| `condemned_cleaver` | weapon | damage +7, attackCooldownMs +70 | first weapon since `starter_pipe` (flat dmg+3, no downside); trades attack speed for a much larger hit |
| `warden_plate` | chest | armor +5, maxHp +15 | `sewer_jacket` scaled up (armor+2/hp+5); first chest item with a clearly higher power budget, giving the gear-comparison affordance (Task 358) something meaningful to show |
| `scavenger_king_helm` | head | armor +3, toughness +2 | `scavenged_hood` (armor+1 only) has no toughness-bearing head item today |

**Static Yard family (speed, utility, mind):**

| id | slot | statModifiers | why it's distinct |
|---|---|---|---|
| `livewire_lance` | weapon | damage +4, attackCooldownMs -70 | first fast-attack weapon; contrasts directly with `condemned_cleaver`'s slow-heavy profile and `starter_pipe`'s flat number |
| `chargeplate_vest` | chest | mind +3, moveSpeed +0.12, armor +1 | first item combining a primary stat (mind) with a derived stat (moveSpeed) — no existing item does this |
| `static_wraps` | hands | attackCooldownMs -70, moveSpeed +0.12 | `wraptape_gloves` scaled up and given a second stat (cooldown -40 only today) |

Guardrails:

- Reuse the exact `ItemContentDefinition` shape from Task 356/357 — no new fields, no new `ItemCategory` values, no new `EquipmentSlot` values (all six items use slots that already exist: `weapon`, `chest`, `head`, `hands`).
- Every new item must have a `statModifiers` combination that does not already exist on any current item — this is the actual "distinct stat profile" bar, not just a new id with a bigger number.
- No new items requested in accessory/belt/flask slots — the user's stated scope is weapon/armor. If those categories end up needed to make a table's epic tier feel populated, that's a scope question to raise before adding, not a default.

### 2. Third Rarity Tier — `epic`

**Goal:** Add `"epic"` as a real, obtainable rarity tier, populated in all four existing loot tables, with real client-visible presentation.

Candidate scope:

- Extend `ItemRarity` to `"common" | "rare" | "epic"` in `packages/content/src/data/types.ts`.
- Tag all six new items (Pillar 1) with `rarity: "epic"`.
- Add epic entries to all four loot tables:
  - `sewer_starter_loot`, `sewer_brute_loot`, `sewer_skitter_loot` share the three Blackwire-family epic items as their epic pool, mirroring how they already share `rustbound_ring` as their shared `rare` entry. `sewer_brute_loot` gets a modestly higher epic weight than the other two, mirroring the existing brute-gets-slightly-better-odds pattern on the `rare` tier.
  - `static_yard_loot` gets the three Static Yard-family epic items as its own epic pool, mirroring how it already has its own distinct `rare` entry (`signal_scarred_amulet`) instead of sharing Blackwire's.
- Set epic weights meaningfully below the existing `rare` weights (today's rare weights are 1-2 against a common pool around 100-110). `LootTableEntryDefinition.weight` has no integer constraint — only `entry.weight <= 0` is rejected by `ContentValidation.ts` — so epic entries can use a fractional weight (e.g. ~0.3-0.5) to sit clearly below rare without having to renumber the rest of each table.
- Do **not** add the six new epic items to `vendorStocks.ts`. Unlike Task 356's common slot-coverage items, epic items should be drop-only — a guaranteed purchase path would undercut the entire point of adding a rarity tier.

Guardrails:

- Additive only: do not remove, rename, or reweight any existing `common`/`rare` entry in any of the four tables. (Adding new weighted entries will slightly dilute existing entries' effective odds — that is an expected, acceptable consequence of adding rows, not a rebalance pass, and does not need separate justification.)
- No fourth tier (e.g. "legendary") — scope is exactly one new tier.
- No affix system, no rolled/randomized stats on epic items — they are fixed `ItemContentDefinition`s like everything else in the game today.

### 3. Client Rarity Presentation

**Goal:** Make the new tier visually real to players, not just present in data.

Candidate scope:

- Extend `getItemRarityColor` / `getItemRarityStrokeColor` in `worldSessionLootPlaceholderView.ts` (world-loot ground color/glow) with an `epic` branch. Recommend a purple in the `#c77dff` family — distinct from common's tan/gold and rare's blue, matching established ARPG rarity-color convention.
- Extend `getItemRarityColor` in `worldSessionEquipmentView.ts` (equipped-item panel text) with the same `epic` branch/color for consistency between world-loot and equipped-item display.
- Sweep the other files that reference `rarity` client-side (`worldSessionOverlayView.ts`, `WorldSessionScene.ts`, `worldSessionAreaView.ts`, `worldSessionFeedbackView.ts`, `townRoomWorldLoot.ts`, `pickupWorldLootClient.ts`) for any other hardcoded `rarity === "rare"` branch and extend it. Most of these pass the rarity string through generically (e.g. into a pickup-feedback message) and need no change — only branching logic needs updating.

Guardrails:

- Pure presentation change — no new UI panels, no new interaction affordances beyond what already exists for `common`/`rare` items.
- Verify Task 358's gear-comparison affordance renders correctly against all six new items across every slot they touch (weapon, chest, head, hands) as part of manual verification, since that affordance was only just fixed for the existing two-tier item set.

### 4. New Skill (optional — cut first under scope pressure)

**Goal:** Add one small new skill — explicitly not a skill-system overhaul, and explicitly the first thing to drop if items + rarity tier consume the available scope.

**This pillar cannot be scoped as "just add a skills.ts entry."** The audit above found that the current skill system doesn't work in either real combat zone. Copy-pasting Grave Spark's pattern a second time would ship a feature with the same gap: a skill nobody can use in Blackwire Sewers or Static Yard, which is a fake feature under `AGENTS.md`. If this pillar is pursued, its real scope is:

1. Add the new skill to `skills.ts` as a `SkillContentDefinition` — same shape as `heavy_strike` today (`id`, `nameKey`, `descriptionKey`, `targeting: "target"`, `range`, `cooldownMs`, `baseDamage`). No new fields.
2. Generalize the currently-hardcoded `GRAVE_SPARK_*` constants into a small content lookup (resolve range/damage/cooldown from the matching `skills.ts` entry instead of hand-written numbers) so the new skill doesn't require a third hand-copied ~150-line handler. This is a contained refactor of the one existing handler, not a new system — same spirit as Wave 2 of the 0.6 plan generalizing `waypointService.ts` before a second zone doubled its hardcoding.
3. Register the (now content-driven) skill-slot handler in `CombatRoom.ts`, reusing `applyEnemyDamage` / `spawnWorldLootOnEnemyDefeat` / objective-progress / XP-grant calls exactly as `request_attack` already does there (`CombatRoom.ts:574-666`). This is the fix that makes either skill actually castable in real combat — not new functionality, a gap closure.
4. Give the new skill its own slot (mirroring how "secondary" was itself added next to basic attack — new keybind, new HUD cooldown display, new field on `PlayerPresence`) rather than replacing Grave Spark. A shared/selectable slot would be a loadout system, which is explicitly out of scope.

Guardrails:

- No skill points, talent trees, or multi-skill loadout/selection UI.
- No new AI states or enemy behavior introduced in response to the new skill.
- `targeting: "target"` only — no AoE, no self-cast, no new targeting modes.
- If this pillar is cut, the CombatRoom skill-slot gap remains as documented tech debt for a future build — it must not be silently folded into an unrelated pillar, and must not be quietly "fixed" as a side effect of other work without being called out.

---

## Core 0.7 Non-Goals

```text
new equipment slot types
crafting / enchanting / affix rolling / randomized item stats
a fourth rarity tier (legendary or otherwise) — exactly one new tier this build
new town/hub zone, new region/kraj, world-map travel system
skill points, talent trees, multi-skill loadout/selection UI
new AI state machine, ranged/projectile enemies, group-aggro mechanics
new class/origin content
full economy (auction house, trading, restock timers)
Vue / app-shell migration
pets / mounts / familiars
professions, housing, guilds, PvP
rebalancing existing common/rare loot entries beyond the dilution effect of adding epic rows
```

---

## 0.6 Freeze / Stability Baseline

Core Build 0.6 should now be treated as the stable shipped baseline. That means:

- 0.6 remains RC / bugfix-only.
- No new 0.6 feature pillar should be opened.
- New scope is planned under 0.7.
- Any 0.6 bug fix must be minimal and regression-focused.

The baseline loop being preserved is the full 0.6 loop:

```text
Nightmarket hub
→ notice board objective catalog
→ route/waypoint travel to Blackwire Sewers or Static Yard
→ enemy kill (per-archetype loot tables) / loot / XP / objective progress
→ gear comparison against currently-equipped item, 9/9 equipment slots fillable
→ return to town via physical return gate
→ turn-in / vendor / stash / completed-objective history / repeat
```

---

## Candidate Task Waves

### Wave 1 — Planning

- Finalize 0.7 scope documents
- Reconfirm the 0.6 loop as the stable baseline 0.7 must not break

### Wave 2 — Item Content and Rarity Tier (priority)

- Extend `ItemRarity` to include `"epic"` in `packages/content/src/data/types.ts`
- Add the six new `ItemContentDefinition`s to `items.ts` (Pillar 1's table)
- Add required localization keys (`item.<id>.name` / `.description`) to `en.ts` and `LocaleTypes.ts`
- Add epic entries to all four loot tables in `lootTables.ts`, weighted below existing `rare` entries
- Explicitly do not add the new items to `vendorStocks.ts`

### Wave 3 — Client Rarity Presentation

- Extend `getItemRarityColor` / `getItemRarityStrokeColor` in `worldSessionLootPlaceholderView.ts` and `getItemRarityColor` in `worldSessionEquipmentView.ts` with an `epic` branch
- Sweep remaining client rarity touch-points for any other hardcoded `rare`-only branch
- Manual verification: epic loot renders with distinct color/glow in both Blackwire Sewers and Static Yard; equipped epic items display correctly; Task 358's gear-comparison affordance works correctly against all six new items

### Wave 4 — New Skill (optional, cut first)

- Add the new skill to `skills.ts`
- Generalize Grave Spark's hardcoded constants into a skill-content lookup
- Register the skill-slot handler in `CombatRoom.ts`
- Add the new skill's own slot (keybind, HUD cooldown, `PlayerPresence` field)
- If cut: explicitly record the CombatRoom skill-slot gap as open tech debt rather than leaving it merely implied

### Wave 5 — Polish and RC Closure

- Full manual verification pass: fight in both zones, confirm epic drops surface with correct rarity/stats/visuals, confirm existing common/rare drops are unaffected, confirm vendor stock is unaffected
- `pnpm typecheck` across all workspace packages
- Close toward controlled 0.7 RC / bugfix-only state

---

## Risks

1. **Epic weights landing "dead" or "flooded."** Too low and the tier feels like it doesn't exist (repeating 0.5/0.6's original problem in a new form); too high and it cheapens `rare`. Mitigate by setting epic weight clearly below existing `rare` weight (fractional, e.g. ~0.3-0.5 against a ~100+ common pool) and verifying via repeated manual kills during Wave 5, not just by inspection of the table.
2. **The discovered CombatRoom skill-slot gap makes Wave 4 larger than "add a skill."** If scope pressure forces a cut, this pillar is the one to drop — per the user's explicit priority (items > skill) — but the gap itself must be written down as known debt, not silently dropped along with the pillar.
3. **Incomplete client rarity sweep.** A missed hardcoded `rarity === "rare"` branch would make epic items drop and equip correctly but display with common's styling, which is a real (if minor) fake-feature risk under `AGENTS.md`. Mitigate with the explicit sweep step in Wave 3, not just the two known color-mapping functions.
4. **Content/localization scaling (recurring risk, same as 0.5 and 0.6).** Six new items (12 localization keys) plus, if Wave 4 ships, one new skill (2 more keys) must all be present in `en.ts`/`LocaleTypes.ts` or `validateContentRegistry` fails fast at content-load time. Same watch-item as every prior build's plan.

---

## Decision: Recommended Order

Start with **Wave 2 — Item Content and Rarity Tier**. It is the build's stated priority, it is self-contained (pure content + type addition, no protocol changes per the audit above), and it is the direct, final answer to a gap that has been explicitly deferred twice. Wave 3 (client presentation) should ship in the same pass — an epic tier with no visual identity is only half-closed. Wave 4 (skill) is attempted only if Waves 2-3 land cleanly with scope to spare, and is the first and only thing to cut if not.

---

## Validation Expectations for Future 0.7 Tasks

```bash
pnpm typecheck
```

(No `lint`/`test`/`build` scripts are currently exercised per-task in this repo's established workflow — see 0.4-0.6 task notes, which verify via `pnpm typecheck` only.)

Manual validation should emphasize:

- no regression in the shipped 0.6 loop, in both Blackwire Sewers and Static Yard,
- epic items drop, display, equip, and compare (Task 358 affordance) correctly in both zones,
- existing `common`/`rare` drop behavior is unchanged in effect (aside from the expected, acceptable weight-dilution from adding new rows),
- if Wave 4 ships: the new skill is castable in both combat zones, not just Nightmarket — this is the actual bar for "not a fake feature" per the audit finding above,
- new content passes the same manual `validateContentRegistry` rule-by-rule check used in 0.5/0.6 (still not wired into any build/test script).

---

## Summary

Core Build 0.7 is the **Itemization Payoff** build. Its job is to finally add enough new weapon/armor items — with stat profiles genuinely distinct from the current 11-item pool — to give a third rarity tier real population across both of the game's combat zones, closing a gap explicitly deferred in both 0.5 and 0.6. A small new skill is in scope only if the item work leaves room, and the audit here should stop it from being scoped as smaller than it is: the game's one existing skill currently can't be cast in either real combat zone, and a second skill built the same way would inherit that gap.
