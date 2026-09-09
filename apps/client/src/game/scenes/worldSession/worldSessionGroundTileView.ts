import Phaser from "phaser";
import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";

import {
  resolveWorldAxisScreenRotationRadians,
  worldToScreenActiveProjection,
  type WorldProjectionBounds,
  type WorldProjectionMode,
  type WorldProjectionViewport,
} from "../../worldProjection";

/**
 * Core 0.22 — Phase 1 of isometric art integration. Renders a zone's
 * ground/floor tiles by looking up its `groundTileKey` through the
 * content registry and resolving that to a Phaser texture key already
 * queued by `visualAssetLoader.ts`'s `queueZoneGroundTileLoad` in
 * `WorldSessionScene.preload()`. This module never reads a file path --
 * only the semantic key. See docs/CORE_BUILD_0_22_PLAN.md.
 */
const GROUND_TILE_BASE_WORLD_SIZE = 100;

// Core 0.36 follow-up -- namesti_republiky's real-world-derived bounds
// (packages/content/src/data/zones.ts, ~9500x10000 world units, vs. the
// ~800x600 arena zones this tiling was originally sized for) meant a
// 100-unit tile projected down to single-digit/low-teens screen pixels
// there -- the isobricks.png source image (500x500) minified that far
// aliases into solid-colored blotches instead of a recognizable tile,
// which read as a persistent, out-of-place stack of colored squares.
// The tile's *world* size is scaled up (never down -- a small arena
// zone keeps its original crisp 100-unit tiles) so it never projects
// smaller than this on screen, keeping the source art legible at any
// zone scale.
const MIN_GROUND_TILE_SCREEN_PX = 96;

interface GroundTileProjectionInput {
  readonly zoneId: string;
  readonly bounds: WorldProjectionBounds;
  readonly viewport: WorldProjectionViewport;
  readonly projectionMode: WorldProjectionMode;
  readonly rotationDeg?: number;
}

interface GroundTileCell {
  readonly key: string;
  readonly worldCenterX: number;
  readonly worldCenterY: number;
}

interface ProjectedGroundTile {
  readonly screenX: number;
  readonly screenY: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly screenRotation: number;
}

export interface WorldSessionGroundTileView {
  readonly refresh: (projection: GroundTileProjectionInput) => void;
  readonly updateProjection: (projection: GroundTileProjectionInput) => void;
  readonly destroy: () => void;
}

export function createWorldSessionGroundTileView(
  scene: Phaser.Scene,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionGroundTileView {
  const container = scene.add.container(0, 0);
  parentContainer?.add(container);
  const tileImages = new Map<string, Phaser.GameObjects.Image>();
  let currentZoneId: string | null = null;
  let currentTileWorldSize: number | null = null;

  const destroyAllTiles = (): void => {
    for (const image of tileImages.values()) {
      image.destroy();
    }
    tileImages.clear();
  };

  // Core 0.36 follow-up -- picks the tile's *world* size so it never
  // projects smaller than MIN_GROUND_TILE_SCREEN_PX on screen, no matter
  // how large the zone's real-world-derived bounds are relative to the
  // viewport. Only ever scales up from GROUND_TILE_BASE_WORLD_SIZE, so an
  // arena-sized zone (bounds already close to viewport scale) keeps its
  // original crisp 100-unit tiles unchanged.
  const resolveEffectiveTileWorldSize = (
    bounds: WorldProjectionBounds,
    viewport: WorldProjectionViewport,
  ): number => {
    const camWidth = bounds.maxX - bounds.minX;
    const camHeight = bounds.maxY - bounds.minY;
    if (camWidth <= 0 || camHeight <= 0 || viewport.width <= 0 || viewport.height <= 0) {
      return GROUND_TILE_BASE_WORLD_SIZE;
    }

    const worldUnitsPerScreenPx = Math.max(camWidth / viewport.width, camHeight / viewport.height);
    return Math.max(GROUND_TILE_BASE_WORLD_SIZE, MIN_GROUND_TILE_SCREEN_PX * worldUnitsPerScreenPx);
  };

  const buildCells = (
    bounds: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number },
    tileWorldSize: number,
  ): readonly GroundTileCell[] => {
    const cells: GroundTileCell[] = [];
    const startCol = Math.floor(bounds.minX / tileWorldSize);
    const endCol = Math.ceil(bounds.maxX / tileWorldSize);
    const startRow = Math.floor(bounds.minY / tileWorldSize);
    const endRow = Math.ceil(bounds.maxY / tileWorldSize);
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        cells.push({
          key: `${row}_${col}`,
          worldCenterX: (col + 0.5) * tileWorldSize,
          worldCenterY: (row + 0.5) * tileWorldSize,
        });
      }
    }
    return cells;
  };

  // `worldToScreenDebugTopDown` is a per-axis linear scale, so an
  // axis-aligned rectangle tiles it exactly. `worldToScreenIsometricPreview`
  // is a real diamond shear -- the same rectangle would leave visible gaps/
  // overlaps there, which is a visual bug, not a rougher-but-valid render.
  // isometric_preview is already a dev-only toggle with click-to-move
  // disabled, so this view deliberately renders nothing in that mode
  // rather than rendering it wrong. True isometric tile projection is
  // follow-up work, not this phase's.
  const projectCell = (
    cell: GroundTileCell,
    projection: GroundTileProjectionInput,
    tileWorldSize: number,
  ): ProjectedGroundTile | null => {
    if (projection.projectionMode !== "debug_top_down") {
      return null;
    }

    const camWidth = projection.bounds.maxX - projection.bounds.minX;
    const camHeight = projection.bounds.maxY - projection.bounds.minY;
    if (camWidth <= 0 || camHeight <= 0) {
      return null;
    }

    const center = worldToScreenActiveProjection(
      cell.worldCenterX,
      cell.worldCenterY,
      projection.bounds,
      projection.viewport,
      projection.projectionMode,
      projection.rotationDeg,
    );

    return {
      screenX: center.x,
      screenY: center.y,
      screenWidth: (tileWorldSize / camWidth) * projection.viewport.width,
      screenHeight: (tileWorldSize / camHeight) * projection.viewport.height,
      // Tiles are axis-aligned squares in raw world space -- under a
      // non-zero rotationDeg they must be rotated the same amount on
      // screen too, or their (still axis-aligned) edges leave gaps
      // against their (now-rotated) neighbors' centers.
      screenRotation: resolveWorldAxisScreenRotationRadians(
        projection.bounds,
        projection.viewport,
        projection.projectionMode,
        projection.rotationDeg ?? 0,
      ),
    };
  };

  const resolveTextureKey = (zoneId: string): string | null => {
    const zone = contentRegistry.zones.get(zoneId as ZoneContentId);
    const groundTileKey = zone?.groundTileKey;
    if (groundTileKey === undefined || !contentRegistry.visualAssets.has(groundTileKey)) {
      return null;
    }
    // The texture is only guaranteed present if WorldSessionScene.preload()
    // actually queued it (queueZoneGroundTileLoad) and Phaser finished
    // loading before create() ran. Guard rather than assume.
    if (!scene.textures.exists(groundTileKey)) {
      return null;
    }
    return groundTileKey;
  };

  const refresh = (projection: GroundTileProjectionInput): void => {
    destroyAllTiles();
    currentZoneId = projection.zoneId;
    currentTileWorldSize = null;

    const textureKey = resolveTextureKey(projection.zoneId);
    if (textureKey === null) {
      return;
    }

    const zone = contentRegistry.zones.get(projection.zoneId as ZoneContentId);
    if (zone === undefined) {
      return;
    }

    const tileWorldSize = resolveEffectiveTileWorldSize(projection.bounds, projection.viewport);
    currentTileWorldSize = tileWorldSize;

    for (const cell of buildCells(zone.bounds, tileWorldSize)) {
      const projected = projectCell(cell, projection, tileWorldSize);
      if (projected === null) {
        continue;
      }
      const image = scene.add.image(projected.screenX, projected.screenY, textureKey);
      image.setDisplaySize(projected.screenWidth, projected.screenHeight);
      image.setRotation(projected.screenRotation);
      tileImages.set(cell.key, image);
      container.add(image);
    }
  };

  const updateProjection = (projection: GroundTileProjectionInput): void => {
    if (currentZoneId !== projection.zoneId) {
      refresh(projection);
      return;
    }

    if (tileImages.size === 0) {
      return;
    }

    const zone = contentRegistry.zones.get(projection.zoneId as ZoneContentId);
    if (zone === undefined) {
      return;
    }

    // A changed viewport/camera scale (e.g. window resize) shifts what
    // MIN_GROUND_TILE_SCREEN_PX resolves to -- rebuild the whole grid
    // rather than reposition a grid sized for the old scale.
    const tileWorldSize = resolveEffectiveTileWorldSize(projection.bounds, projection.viewport);
    if (currentTileWorldSize === null || Math.abs(tileWorldSize - currentTileWorldSize) > 0.001) {
      refresh(projection);
      return;
    }

    for (const cell of buildCells(zone.bounds, tileWorldSize)) {
      const image = tileImages.get(cell.key);
      if (image === undefined) {
        continue;
      }
      const projected = projectCell(cell, projection, tileWorldSize);
      if (projected === null) {
        image.setVisible(false);
        continue;
      }
      image.setVisible(true);
      image.setPosition(projected.screenX, projected.screenY);
      image.setDisplaySize(projected.screenWidth, projected.screenHeight);
      image.setRotation(projected.screenRotation);
    }
  };

  return {
    refresh,
    updateProjection,
    destroy: () => {
      destroyAllTiles();
      container.destroy();
    },
  };
}
