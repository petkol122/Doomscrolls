import type { VisualAssetContentDefinition } from "./types";

/**
 * Core 0.22 — Phase 1 of isometric art integration. One real row,
 * proving the pipeline (semantic key -> registry -> Phaser texture)
 * end to end, rather than mapping the full monogon "Isometric Dark
 * Souls Gothic" pack in one pass. See docs/CORE_BUILD_0_22_PLAN.md.
 *
 * Core 0.23 — two more asset integrations, both perspective-agnostic
 * (icons/UI, not world sprites), each proving the same registry
 * pattern for its own category:
 *
 * - Item icons: `id` for each row below is the EXISTING `iconKey`
 *   string already on that item in `items.ts` (e.g.
 *   "item_starter_pipe_placeholder") -- not a newly invented key.
 *   Items.ts is untouched; this file maps its existing keys to real
 *   files from Glionox's "items16" pack (the 1244 numbered 16x16 icons
 *   under apps/client/public/assets/items/ -- a second, food-themed
 *   32x32 icon set shares that folder but is a different, unrelated
 *   pack and is not used here). Every icon below was visually
 *   confirmed (via a generated contact sheet, not guessed from a
 *   filename -- the pack ships with no names at all) to reasonably
 *   depict its item's category before being mapped; an item with no
 *   reasonable match in the pack simply has no row here; its icon
 *   lookup misses and it keeps its current placeholder rendering. See
 *   docs/CORE_BUILD_0_23_PLAN.md for the full per-item rationale.
 *
 * - Enemy HP bar: one spritesheet row (bdragon1727's health-bar pack,
 *   apps/client/public/assets/UI/05.png) driving the real per-enemy
 *   HP/maxHp already tracked server-side.
 *
 * Core 0.26 — inventory/equipment slot-grid rarity framing. Three
 * pre-cropped 24x24 slot-frame images (apps/client/public/assets/UI/
 * rarity_common.png / rarity_rare.png / rarity_epic.png), cut from the
 * same `UI/02.png` sheet the enemy HP bar's pack ships alongside (a
 * grid of colored square slot-frame icons, one color family per
 * rarity-adjacent tone: green/orange/cyan/purple). Mapped to this
 * project's real, existing `ItemRarity` tiers ("common"/"rare"/"epic" —
 * see packages/content/src/data/types.ts; there is no "legendary"
 * tier, so the sheet's orange family is deliberately left unmapped):
 * common -> green, rare -> cyan (matches the rare-is-blue color this
 * client already used for item-name text), epic -> purple (ditto,
 * already used for epic item-name text). Pre-cropped to individual
 * files (matching how item icons are individual files, not sliced from
 * a sheet at runtime) rather than using `frameWidth`/`frameHeight`
 * slicing, because the three source cells sit at different (x, y)
 * offsets in the sheet, not consecutive frames in one row the way the
 * HP bar's are.
 */
export const visualAssets: readonly VisualAssetContentDefinition[] = [
  {
    id: "ground_stone",
    category: "ground_tile",
    path: "/assets/isobricks.png",
    sourceWidth: 500,
    sourceHeight: 500
  },

  // ── Enemy HP bar (bdragon1727 health-bar pack) ──
  // Frames 0-5 share a consistent 48x32 footprint (a full, tapering-color
  // bar); frames 6-7 in the same sheet are a visibly smaller/differently
  // proportioned "critical" variant and are deliberately not used here to
  // avoid a jarring size jump -- only frames 0-5 are selected at runtime.
  {
    id: "enemy_hp_bar_strip",
    category: "hp_bar",
    path: "/assets/UI/05.png",
    sourceWidth: 384,
    sourceHeight: 32,
    frameWidth: 48,
    frameHeight: 32,
    frameCount: 8
  },

  // ── Rarity slot frames (same pack as the HP bar, UI/02.png) ──
  { id: "rarity_frame_common", category: "rarity_frame", path: "/assets/UI/rarity_common.png", sourceWidth: 24, sourceHeight: 24 },
  { id: "rarity_frame_rare", category: "rarity_frame", path: "/assets/UI/rarity_rare.png", sourceWidth: 24, sourceHeight: 24 },
  { id: "rarity_frame_epic", category: "rarity_frame", path: "/assets/UI/rarity_epic.png", sourceWidth: 24, sourceHeight: 24 },

  // ── Item icons (Glionox items16) ──
  // Weapons
  { id: "item_starter_pipe_placeholder", category: "item_icon", path: "/assets/items/item1.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_tideworn_cutlass_placeholder", category: "item_icon", path: "/assets/items/item9.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_condemned_cleaver_placeholder", category: "item_icon", path: "/assets/items/item3.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_livewire_lance_placeholder", category: "item_icon", path: "/assets/items/item22.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_slagforged_maul_placeholder", category: "item_icon", path: "/assets/items/item61.png", sourceWidth: 16, sourceHeight: 16 },

  // Head
  { id: "item_scavenged_hood_placeholder", category: "item_icon", path: "/assets/items/item212.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_brinemask_visor_placeholder", category: "item_icon", path: "/assets/items/item219.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_scavenger_king_helm_placeholder", category: "item_icon", path: "/assets/items/item874.png", sourceWidth: 16, sourceHeight: 16 },

  // Chest
  { id: "item_sewer_jacket_placeholder", category: "item_icon", path: "/assets/items/item229.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_saltcrust_vest_placeholder", category: "item_icon", path: "/assets/items/item237.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_warden_plate_placeholder", category: "item_icon", path: "/assets/items/item235.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_chargeplate_vest_placeholder", category: "item_icon", path: "/assets/items/item234.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_cinderplate_hauberk_placeholder", category: "item_icon", path: "/assets/items/item240.png", sourceWidth: 16, sourceHeight: 16 },

  // Hands
  { id: "item_wraptape_gloves_placeholder", category: "item_icon", path: "/assets/items/item243.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_brinewrap_gloves_placeholder", category: "item_icon", path: "/assets/items/item254.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_static_wraps_placeholder", category: "item_icon", path: "/assets/items/item246.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_cinderfist_gauntlets_placeholder", category: "item_icon", path: "/assets/items/item245.png", sourceWidth: 16, sourceHeight: 16 },

  // Feet
  { id: "item_sewer_treads_placeholder", category: "item_icon", path: "/assets/items/item261.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_voltbound_treads_placeholder", category: "item_icon", path: "/assets/items/item256.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_voltbound_greaves_placeholder", category: "item_icon", path: "/assets/items/item265.png", sourceWidth: 16, sourceHeight: 16 },

  // Rings
  { id: "item_frayed_signet_placeholder", category: "item_icon", path: "/assets/items/item872.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_rustbound_ring_placeholder", category: "item_icon", path: "/assets/items/item873.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_voidglass_band_placeholder", category: "item_icon", path: "/assets/items/item894.png", sourceWidth: 16, sourceHeight: 16 },

  // Flasks
  { id: "item_starter_blood_flask_placeholder", category: "item_icon", path: "/assets/items/item913.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_sealed_blood_flask_placeholder", category: "item_icon", path: "/assets/items/item903.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_vital_reserve_flask_placeholder", category: "item_icon", path: "/assets/items/item902.png", sourceWidth: 16, sourceHeight: 16 },

  // Materials
  { id: "item_blackwire_scrap_placeholder", category: "item_icon", path: "/assets/items/item574.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_tarnished_coin_placeholder", category: "item_icon", path: "/assets/items/item1156.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_cinder_ash_placeholder", category: "item_icon", path: "/assets/items/item586.png", sourceWidth: 16, sourceHeight: 16 },
  { id: "item_brine_salt_placeholder", category: "item_icon", path: "/assets/items/item596.png", sourceWidth: 16, sourceHeight: 16 }

  // Not mapped -- no reasonable match found in the pack, keep placeholder:
  // item_scrap_cloth_placeholder (no cloth/fabric icon found), the three
  // amulet items (no necklace/pendant icon found -- bangle/torc shapes
  // exist but reads as a bracelet, not a neck-worn amulet), and the three
  // belt items (no belt/sash/buckle icon found).
];
