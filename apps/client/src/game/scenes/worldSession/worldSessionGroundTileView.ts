import Phaser from "phaser";
import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";

import {
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
const GROUND_TILE_WORLD_SIZE = 100;

interface GroundTileProjectionInput {
  readonly zoneId: string;
  readonly bounds: WorldProjectionBounds;
  readonly viewport: WorldProjectionViewport;
  readonly projectionMode: WorldProjectionMode;
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

  const destroyAllTiles = (): void => {
    for (const image of tileImages.values()) {
      image.destroy();
    }
    tileImages.clear();
  };

  const buildCells = (bounds: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number }): readonly GroundTileCell[] => {
    const cells: GroundTileCell[] = [];
    const startCol = Math.floor(bounds.minX / GROUND_TILE_WORLD_SIZE);
    const endCol = Math.ceil(bounds.maxX / GROUND_TILE_WORLD_SIZE);
    const startRow = Math.floor(bounds.minY / GROUND_TILE_WORLD_SIZE);
    const endRow = Math.ceil(bounds.maxY / GROUND_TILE_WORLD_SIZE);
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        cells.push({
          key: `${row}_${col}`,
          worldCenterX: (col + 0.5) * GROUND_TILE_WORLD_SIZE,
          worldCenterY: (row + 0.5) * GROUND_TILE_WORLD_SIZE,
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
    );

    return {
      screenX: center.x,
      screenY: center.y,
      screenWidth: (GROUND_TILE_WORLD_SIZE / camWidth) * projection.viewport.width,
      screenHeight: (GROUND_TILE_WORLD_SIZE / camHeight) * projection.viewport.height,
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

    const textureKey = resolveTextureKey(projection.zoneId);
    if (textureKey === null) {
      return;
    }

    const zone = contentRegistry.zones.get(projection.zoneId as ZoneContentId);
    if (zone === undefined) {
      return;
    }

    for (const cell of buildCells(zone.bounds)) {
      const projected = projectCell(cell, projection);
      if (projected === null) {
        continue;
      }
      const image = scene.add.image(projected.screenX, projected.screenY, textureKey);
      image.setDisplaySize(projected.screenWidth, projected.screenHeight);
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

    for (const cell of buildCells(zone.bounds)) {
      const image = tileImages.get(cell.key);
      if (image === undefined) {
        continue;
      }
      const projected = projectCell(cell, projection);
      if (projected === null) {
        image.setVisible(false);
        continue;
      }
      image.setVisible(true);
      image.setPosition(projected.screenX, projected.screenY);
      image.setDisplaySize(projected.screenWidth, projected.screenHeight);
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
