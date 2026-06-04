export const worldProjection = "debug_top_down" as const;

export const futureTargetProjection = "isometric_2_5d" as const;

export type WorldProjectionMode = typeof worldProjection | typeof futureTargetProjection;

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
  readonly worldProjection: typeof worldProjection;
  readonly futureTargetProjection: typeof futureTargetProjection;
} {
  return {
    worldProjection,
    futureTargetProjection,
  };
}