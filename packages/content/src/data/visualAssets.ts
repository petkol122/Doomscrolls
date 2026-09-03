import type { VisualAssetContentDefinition } from "./types";

/**
 * Core 0.22 — Phase 1 of isometric art integration. One real row,
 * proving the pipeline (semantic key -> registry -> Phaser texture)
 * end to end, rather than mapping the full monogon "Isometric Dark
 * Souls Gothic" pack in one pass. See docs/CORE_BUILD_0_22_PLAN.md.
 */
export const visualAssets: readonly VisualAssetContentDefinition[] = [
  {
    id: "ground_stone",
    category: "ground_tile",
    path: "/assets/isobricks.png",
    sourceWidth: 500,
    sourceHeight: 500
  }
];
