/**
 * Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix
 * Engine. Single source of truth for rarity display color, replacing
 * the `getItemRarityColor` duplicated per-view before this build.
 *
 * Two rarity vocabularies can reach this function: the content
 * package's fixed per-template `ItemRarity` ("common"/"rare"/"epic")
 * for an instance that rolled no affixes, and the per-instance rolled
 * `AffixRarityTier` ("normal"/"magic"/"rare"/"legendary") once the
 * server overrides `rarity` with the rolled tier (see
 * `characterMapper.ts`'s `resolveInstanceRarityAndStats`). Both
 * "rare"s intentionally share one color -- picking a single unified
 * White/Blue/Yellow/Orange ladder is simpler than tracking which
 * vocabulary produced a given string, and "rare" already means
 * roughly the same thing ("above magic, below legendary/epic") in
 * both.
 */
export function getItemRarityColor(rarity?: string): string {
  switch (rarity) {
    case "legendary":
    case "epic":
      return "#ff8c3d"; // Orange
    case "rare":
      return "#ffd23f"; // Yellow
    case "magic":
      return "#4a90ff"; // Blue
    default:
      return "#e8e6e0"; // White (normal/common/unrecognized)
  }
}

export function getItemRarityAccentColor(rarity?: string): string {
  switch (rarity) {
    case "legendary":
    case "epic":
      return "#c96a1f";
    case "rare":
      return "#b89020";
    case "magic":
      return "#2f5fbf";
    default:
      return "#8a8a86";
  }
}
