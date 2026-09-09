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

/**
 * Rotates a world-space point around the center of `bounds` by
 * `rotationDeg` (clockwise on screen, since world +Y is already south/down).
 * Zero degrees is a no-op -- every zone that doesn't set a rotation
 * renders exactly as before this existed.
 */
function rotateAroundBoundsCenter(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  rotationDeg: number,
): WorldProjectionPoint {
  if (rotationDeg === 0) {
    return { x, y };
  }

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - centerX;
  const dy = y - centerY;

  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
  };
}

/**
 * Core 0.36 -- `rotationDeg` is a single north-alignment correction
 * (see `ZoneContentDefinition.northRotationDeg`) applied around the
 * current camera bounds' own center, before the existing per-axis
 * linear stretch onto the viewport. Zero (the default for every zone
 * today, including namesti_republiky -- its Overpass conversion already
 * places geographic north at -Y/screen-up) is a no-op.
 */
export function worldToScreenDebugTopDown(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
  rotationDeg = 0,
): WorldProjectionPoint {
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  if (worldWidth <= 0 || worldHeight <= 0) {
    return { x: viewport.originX, y: viewport.originY };
  }

  const rotated = rotateAroundBoundsCenter(x, y, bounds, rotationDeg);

  return {
    x: viewport.originX + ((rotated.x - bounds.minX) / worldWidth) * viewport.width,
    y: viewport.originY + ((rotated.y - bounds.minY) / worldHeight) * viewport.height,
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
  rotationDeg = 0,
): WorldProjectionPoint {
  const clampedScreenX = clamp(x, viewport.originX, viewport.originX + viewport.width);
  const clampedScreenY = clamp(y, viewport.originY, viewport.originY + viewport.height);
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  if (worldWidth <= 0 || worldHeight <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { x: bounds.minX, y: bounds.minY };
  }

  const rotatedX = bounds.minX + ((clampedScreenX - viewport.originX) / viewport.width) * worldWidth;
  const rotatedY = bounds.minY + ((clampedScreenY - viewport.originY) / viewport.height) * worldHeight;

  // Inverse of rotateAroundBoundsCenter's forward rotation.
  return rotateAroundBoundsCenter(rotatedX, rotatedY, bounds, -rotationDeg);
}

export function worldToScreenActiveProjection(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
  mode: WorldProjectionMode = defaultWorldProjection,
  rotationDeg = 0,
): WorldProjectionPoint {
  if (mode === "debug_top_down") {
    return worldToScreenDebugTopDown(x, y, bounds, viewport, rotationDeg);
  }

  return worldToScreenIsometricPreview(x, y, bounds, viewport);
}

export function screenToWorldActiveProjection(
  x: number,
  y: number,
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
  mode: WorldProjectionMode = defaultWorldProjection,
  rotationDeg = 0,
): WorldProjectionPoint {
  if (mode === "debug_top_down") {
    return screenToWorldDebugTopDown(x, y, bounds, viewport, rotationDeg);
  }

  return screenToWorldDebugTopDown(x, y, bounds, viewport, rotationDeg);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Screen-space angle (radians) that a shape axis-aligned in raw world
 * space (e.g. a ground tile square, sized in world units) must itself be
 * rotated by so its edges stay flush with neighboring tiles under a
 * non-zero `rotationDeg`. Derived from the projection's actual output
 * rather than `rotationDeg` alone, so it stays correct even though
 * `worldToScreenDebugTopDown`'s per-axis viewport stretch means this
 * isn't always a pure rigid rotation on screen (same disclosed
 * simplification as the non-uniform-scale cases elsewhere in this
 * projection). Always 0 when `rotationDeg` is 0.
 */
export function resolveWorldAxisScreenRotationRadians(
  bounds: WorldProjectionBounds,
  viewport: WorldProjectionViewport,
  mode: WorldProjectionMode,
  rotationDeg: number,
): number {
  if (rotationDeg === 0 || mode !== "debug_top_down") {
    return 0;
  }

  const originWorldX = (bounds.minX + bounds.maxX) / 2;
  const originWorldY = (bounds.minY + bounds.maxY) / 2;
  const origin = worldToScreenDebugTopDown(originWorldX, originWorldY, bounds, viewport, rotationDeg);
  const alongX = worldToScreenDebugTopDown(originWorldX + 10, originWorldY, bounds, viewport, rotationDeg);

  return Math.atan2(alongX.y - origin.y, alongX.x - origin.x);
}