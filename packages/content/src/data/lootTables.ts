import type { ItemDefinitionId } from "@doomscrolls/shared";
import type { LootTableDefinition } from "./types";

const itemId = (value: string): ItemDefinitionId => value as ItemDefinitionId;

export const lootTables = [
  {
    id: "sewer_starter_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 60 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 14 },
      { itemId: itemId("starter_pipe"), rarity: "common", weight: 10 },
      { itemId: itemId("sewer_jacket"), rarity: "common", weight: 7 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 1 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      // Task 356 (Core 0.5) — equipment slot coverage entries.
      { itemId: itemId("scavenged_hood"), rarity: "common", weight: 6 },
      { itemId: itemId("wraptape_gloves"), rarity: "common", weight: 6 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 6 },
      { itemId: itemId("scrapcord_belt"), rarity: "common", weight: 6 },
      { itemId: itemId("signal_scarred_amulet"), rarity: "rare", weight: 1 },
      // Core 0.7 — epic tier, shared Blackwire-family pool (mirrors how
      // rustbound_ring is already shared as the rare entry across all
      // three sewer tables). Weight sits well below rare's weight of 1.
      { itemId: itemId("condemned_cleaver"), rarity: "epic", weight: 0.4 },
      { itemId: itemId("warden_plate"), rarity: "epic", weight: 0.4 },
      { itemId: itemId("scavenger_king_helm"), rarity: "epic", weight: 0.4 },
      // Core 0.19 — rarity matrix pass. Commons/epics for ring_1 and
      // amulet, added alongside each slot's existing rare in the same
      // tables; flask_1's epic joins the shared epic pool above.
      { itemId: itemId("frayed_signet"), rarity: "common", weight: 6 },
      { itemId: itemId("voidglass_band"), rarity: "epic", weight: 0.4 },
      { itemId: itemId("scavenged_cord"), rarity: "common", weight: 6 },
      { itemId: itemId("resonant_choker"), rarity: "epic", weight: 0.4 },
      { itemId: itemId("vital_reserve_flask"), rarity: "epic", weight: 0.4 }
    ]
  },
  {
    // Brute variant: same item pool as sewer_starter_loot, but with a
    // slightly higher rare weight so Brute kills feel marginally more
    // rewarding. Rare items stay controlled relative to the common pool.
    id: "sewer_brute_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 60 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 14 },
      { itemId: itemId("starter_pipe"), rarity: "common", weight: 10 },
      { itemId: itemId("sewer_jacket"), rarity: "common", weight: 6 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 2 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      // Task 356 (Core 0.5) — equipment slot coverage entries.
      { itemId: itemId("scavenged_hood"), rarity: "common", weight: 6 },
      { itemId: itemId("wraptape_gloves"), rarity: "common", weight: 6 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 6 },
      { itemId: itemId("scrapcord_belt"), rarity: "common", weight: 6 },
      { itemId: itemId("signal_scarred_amulet"), rarity: "rare", weight: 2 },
      // Core 0.7 — epic tier, same shared Blackwire-family pool as the
      // other two sewer tables, with brute's modestly higher weight
      // mirroring its existing rare-tier advantage (2 vs 1).
      { itemId: itemId("condemned_cleaver"), rarity: "epic", weight: 0.6 },
      { itemId: itemId("warden_plate"), rarity: "epic", weight: 0.6 },
      { itemId: itemId("scavenger_king_helm"), rarity: "epic", weight: 0.6 },
      // Core 0.19 — rarity matrix pass, same additions as sewer_starter_loot.
      { itemId: itemId("frayed_signet"), rarity: "common", weight: 6 },
      { itemId: itemId("voidglass_band"), rarity: "epic", weight: 0.6 },
      { itemId: itemId("scavenged_cord"), rarity: "common", weight: 6 },
      { itemId: itemId("resonant_choker"), rarity: "epic", weight: 0.6 },
      { itemId: itemId("vital_reserve_flask"), rarity: "epic", weight: 0.6 }
    ]
  },
  {
    // Task 357 (Core 0.5) — Skitter gets its own table instead of sharing
    // Runt's pool. Skitter is the fast/low-value cousin, so its table
    // skews away from heavy armor (pipe/jacket/hood/belt) toward the two
    // speed-flavored pieces, keeping the overall drop pool lighter.
    id: "sewer_skitter_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 55 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 16 },
      { itemId: itemId("wraptape_gloves"), rarity: "common", weight: 12 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 12 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      { itemId: itemId("rustbound_ring"), rarity: "rare", weight: 1 },
      // Core 0.7 — same shared Blackwire-family epic pool as the other
      // two sewer tables.
      { itemId: itemId("condemned_cleaver"), rarity: "epic", weight: 0.4 },
      { itemId: itemId("warden_plate"), rarity: "epic", weight: 0.4 },
      { itemId: itemId("scavenger_king_helm"), rarity: "epic", weight: 0.4 },
      // Core 0.19 — ring_1's common/epic join the same table its rare
      // already lives in; flask_1's epic joins the shared epic pool.
      // No amulet items here -- signal_scarred_amulet was never in this
      // table either, so this doesn't expand that item's footprint.
      { itemId: itemId("frayed_signet"), rarity: "common", weight: 12 },
      { itemId: itemId("voidglass_band"), rarity: "epic", weight: 0.4 },
      { itemId: itemId("vital_reserve_flask"), rarity: "epic", weight: 0.4 }
    ]
  },
  {
    // Core 0.6 — Static Yard's own table. Reuses only existing items (no
    // new items were required by the 0.6 plan); differentiates by weight
    // the same way Task 357 differentiated Skitter's table. Drops entirely
    // exclude the heavy-armor pipe/jacket/hood/belt/ring set and instead
    // lean into the two speed/utility pieces plus the mind-focused
    // amulet, matching the zone's "exposed live current" identity.
    id: "static_yard_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 50 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 15 },
      { itemId: itemId("wraptape_gloves"), rarity: "common", weight: 14 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 14 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      { itemId: itemId("signal_scarred_amulet"), rarity: "rare", weight: 2 },
      // Core 0.17 — voltbound_treads is Static Yard's first genuinely
      // own rare (signal_scarred_amulet above is shared with Blackwire's
      // sewer tables, despite the 0.7-era comment below claiming
      // otherwise -- confirmed by reading item.ts's own item, not by
      // trusting the comment).
      { itemId: itemId("voltbound_treads"), rarity: "rare", weight: 2 },
      // Core 0.7 — Static Yard's own epic pool, distinct from the
      // Blackwire-family items, matching how it already has its own
      // distinct rare entry instead of sharing rustbound_ring.
      { itemId: itemId("livewire_lance"), rarity: "epic", weight: 0.5 },
      { itemId: itemId("chargeplate_vest"), rarity: "epic", weight: 0.5 },
      { itemId: itemId("static_wraps"), rarity: "epic", weight: 0.5 },
      // Core 0.19 — amulet's common/epic join the same table its rare
      // already lives in; feet's epic joins Static Yard's own epic pool,
      // completing the slot the zone already claims via voltbound_treads.
      { itemId: itemId("scavenged_cord"), rarity: "common", weight: 8 },
      { itemId: itemId("resonant_choker"), rarity: "epic", weight: 0.5 },
      { itemId: itemId("voltbound_greaves"), rarity: "epic", weight: 0.5 }
    ]
  },
  {
    // Core 0.16 — Cinderworks' own table, shared by both its enemies
    // (matching Static Yard's own precedent of one zone-wide table
    // rather than Blackwire's older three-way split). Leans on its own
    // signature material (cinder_ash) over the generic blackwire_scrap,
    // and its own rare/epic family instead of reusing another zone's.
    id: "cinderworks_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 45 },
      { itemId: itemId("cinder_ash"), rarity: "common", weight: 20 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 12 },
      { itemId: itemId("scavenged_hood"), rarity: "common", weight: 8 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 8 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      { itemId: itemId("slagbound_charm"), rarity: "rare", weight: 2 },
      { itemId: itemId("slagforged_maul"), rarity: "epic", weight: 0.5 },
      { itemId: itemId("cinderplate_hauberk"), rarity: "epic", weight: 0.5 },
      { itemId: itemId("cinderfist_gauntlets"), rarity: "epic", weight: 0.5 },
      // Core 0.19 — belt's epic joins Cinderworks' own epic pool,
      // completing the slot the zone already claims via slagbound_charm.
      { itemId: itemId("cinderbound_girdle"), rarity: "epic", weight: 0.5 }
    ]
  },
  {
    // Core 0.18 — Saltmere Docks' own table, shared by all three
    // enemies (one-zone-wide-table precedent). No epic entries here --
    // this zone's itemization identity is entirely rare tier, closing
    // the weapon/head/chest/hands gap (see items.ts).
    id: "saltmere_docks_loot",
    entries: [
      { itemId: itemId("blackwire_scrap"), rarity: "common", weight: 45 },
      { itemId: itemId("brine_salt"), rarity: "common", weight: 20 },
      { itemId: itemId("scrap_cloth"), rarity: "common", weight: 12 },
      { itemId: itemId("scavenged_hood"), rarity: "common", weight: 8 },
      { itemId: itemId("sewer_treads"), rarity: "common", weight: 8 },
      { itemId: itemId("tarnished_coin"), rarity: "common", weight: 8 },
      { itemId: itemId("tideworn_cutlass"), rarity: "rare", weight: 1.5 },
      { itemId: itemId("brinemask_visor"), rarity: "rare", weight: 1.5 },
      { itemId: itemId("saltcrust_vest"), rarity: "rare", weight: 1.5 },
      { itemId: itemId("brinewrap_gloves"), rarity: "rare", weight: 1.5 }
    ]
  }
] as const satisfies readonly LootTableDefinition[];
