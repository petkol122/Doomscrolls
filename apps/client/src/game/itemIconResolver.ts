import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId } from "@doomscrolls/shared";

/**
 * Resolves an item's icon to a real URL through the content registry --
 * the only function in the client that reads a `VisualAssetContentDefinition
 * .path` for item icons. Rendering code (inventory/equipment panels) calls
 * this and renders an `<img>` when it returns a URL, or keeps the existing
 * placeholder rendering when it returns null (no reasonable icon match in
 * the pack for this item -- see packages/content/src/data/visualAssets.ts).
 */
export function resolveItemIconUrl(definitionId: ItemDefinitionId): string | null {
  const definition = contentRegistry.items.get(definitionId);
  if (definition === undefined) {
    return null;
  }

  const asset = contentRegistry.visualAssets.get(definition.iconKey);
  return asset?.path ?? null;
}
