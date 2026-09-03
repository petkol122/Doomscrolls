import type Phaser from "phaser";
import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";

/**
 * Resolves the given zone's ground-tile semantic key through the content
 * registry and queues the actual file for Phaser to load. This is the
 * ONLY place client code reads a `VisualAssetContentDefinition.path` --
 * every renderer downstream (see worldSessionGroundTileView.ts) looks up
 * textures by semantic key only, so swapping the underlying asset pack
 * later means editing packages/content/src/data/visualAssets.ts, not
 * this file or any rendering code.
 *
 * No-ops when the zone has no `groundTileKey` (every zone but the one
 * Core 0.22 Phase 1 covers) or the texture is already loaded (zone
 * revisit / `scene.restart()` on travel).
 */
export function queueZoneGroundTileLoad(scene: Phaser.Scene, zoneId: string): void {
  const zone = contentRegistry.zones.get(zoneId as ZoneContentId);
  const groundTileKey = zone?.groundTileKey;
  if (groundTileKey === undefined) {
    return;
  }

  const asset = contentRegistry.visualAssets.get(groundTileKey);
  if (asset === undefined) {
    return;
  }

  if (scene.textures.exists(asset.id)) {
    return;
  }

  scene.load.image(asset.id, asset.path);
}

/**
 * Semantic key for the enemy HP bar spritesheet (bdragon1727's health-bar
 * pack). Shared between the loader below and worldSessionEnemyPlaceholderView.ts
 * so the two never drift from each other's copy of the string.
 */
export const ENEMY_HP_BAR_ASSET_ID = "enemy_hp_bar_strip";

/**
 * Queues the enemy HP bar spritesheet for Phaser to load. Unlike the
 * ground tile above, this is not zone-gated -- every room kind renders
 * enemy placeholders, so the sheet is queued unconditionally. No-ops if
 * the registry row is missing or the texture is already loaded.
 */
export function queueEnemyHpBarLoad(scene: Phaser.Scene): void {
  const asset = contentRegistry.visualAssets.get(ENEMY_HP_BAR_ASSET_ID);
  if (asset === undefined || asset.frameWidth === undefined || asset.frameHeight === undefined) {
    return;
  }

  if (scene.textures.exists(asset.id)) {
    return;
  }

  scene.load.spritesheet(asset.id, asset.path, {
    frameWidth: asset.frameWidth,
    frameHeight: asset.frameHeight,
  });
}
