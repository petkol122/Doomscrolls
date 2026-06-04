export const defaultWorldProjection = "debug_top_down" as const;

export const isometricPreviewWorldProjection = "isometric_preview" as const;

export type WorldProjectionMode = typeof defaultWorldProjection | typeof isometricPreviewWorldProjection;

export interface WorldProjectionPoint {
  readonly x: number;
  readonly y: number;
}

export interface WorldProjectionBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface WorldProjectionViewport {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Core 0.1 client projection direction lock.
 *
 * Runtime remains Phaser 2D and the current world/session rendering still uses
 * a temporary debug top-down projection. The long-term visual target is a fixed
 * Diablo-like isometric 2.5D presentation with 2D/pre-rendered assets,
 * depth sorting, layered objects and shadow work added in later dedicated
 * visual tasks.
 *
 * This module is documentation + constants only. It does not perform any
 * rendering conversion, camera rotation or visual behavior changes.
 */
export function getWorldProjectionConfig(): {
  readonly worldProjection: typeof defaultWorldProjection;
  readonly futureTargetProjection: typeof isometricPreviewWorldProjection;
} {
  return {
    worldProjection: defaultWorldProjection,
    futureTargetProjection: isometricPreviewWorldProjection,
  };
}

export function worldToScreenDebugTopDown(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
): WorldProjectionPoint {
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  if (worldWidth <= 0 || worldHeight <= 0) {
    return { x: viewport.originX, y: viewport.originY };
  }

  return {
    x: viewport.originX + ((x - bounds.minX) / worldWidth) * viewport.width,
    y: viewport.originY + ((y - bounds.minY) / worldHeight) * viewport.height,
  };
}

export function worldToScreenIsometricPreview(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
): WorldProjectionPoint {
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  if (worldWidth <= 0 || worldHeight <= 0) {
    return { x: viewport.originX, y: viewport.originY };
  }

  const normalizedX = (x - bounds.minX) / worldWidth - 0.5;
  const normalizedY = (y - bounds.minY) / worldHeight - 0.5;
  const halfWidth = viewport.width / 2;
  const quarterHeight = viewport.height / 4;
  const centerX = viewport.originX + viewport.width / 2;
  const centerY = viewport.originY + viewport.height / 2;

  return {
    x: centerX + (normalizedX - normalizedY) * halfWidth,
    y: centerY + (normalizedX + normalizedY) * quarterHeight,
  };
}

export function screenToWorldDebugTopDown(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
): WorldProjectionPoint {
  const clampedScreenX = clamp(x, viewport.originX, viewport.originX + viewport.width);
  const clampedScreenY = clamp(y, viewport.originY, viewport.originY + viewport.height);
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  if (worldWidth <= 0 || worldHeight <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { x: bounds.minX, y: bounds.minY };
  }

  return {
    x: bounds.minX + ((clampedScreenX - viewport.originX) / viewport.width) * worldWidth,
    y: bounds.minY + ((clampedScreenY - viewport.originY) / viewport.height) * worldHeight,
  };
}

export function worldToScreenActiveProjection(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
  mode: WorldProjectionMode = defaultWorldProjection,
): WorldProjectionPoint {
  if (mode === "debug_top_down") {
    return worldToScreenDebugTopDown(x, y, bounds, viewport);
  }

  return worldToScreenIsometricPreview(x, y, bounds, viewport);
}

export function screenToWorldActiveProjection(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
  mode: WorldProjectionMode = defaultWorldProjection,
): WorldProjectionPoint {
  if (mode === "debug_top_down") {
    return screenToWorldDebugTopDown(x, y, bounds, viewport);
  }

  return screenToWorldDebugTopDown(x, y, bounds, viewport);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}