import { contentRegistry } from "@doomscrolls/content";

/**
 * Resolves an item's rarity to a real slot-frame URL through the content
 * registry -- the only function in the client that reads a
 * `VisualAssetContentDefinition.path` for rarity framing (see
 * packages/content/src/data/visualAssets.ts). Rendering code (inventory/
 * equipment panels) calls this and draws the frame image behind/around
 * the slot when it returns a URL, or renders an unframed slot when it
 * returns null (no rarity, or a rarity string this build doesn't
 * recognize -- never invents a tier that isn't in `ItemRarity`).
 */
export function resolveRarityFrameUrl(rarity: string | undefined): string | null {
  const id = rarity === "epic" ? "rarity_frame_epic" : rarity === "rare" ? "rarity_frame_rare" : rarity === "common" ? "rarity_frame_common" : null;
  if (id === null) {
    return null;
  }

  const asset = contentRegistry.visualAssets.get(id);
  return asset?.path ?? null;
}
