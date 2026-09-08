import type { CharacterClassKey } from "@doomscrolls/shared";

/**
 * Core 0.27 -- cheap per-class color differentiator for another player's
 * placeholder (Question 2: reuse the existing placeholder shape, add a
 * tint, no new art). Client-only cosmetic lookup keyed by a content id,
 * not content-registry-driven -- same pattern as `VARIANT_VISUALS` in
 * worldSessionEnemyPlaceholderView.ts (presentation, not game data).
 */
export interface PlayerPlaceholderTint {
  readonly torsoColor: number;
  readonly shoulderColor: number;
  readonly legsColor: number;
  readonly ringStrokeColor: number;
}

// Matches the local player's own current fixed palette
// (worldSessionPlayerPlaceholderView.ts) -- used whenever no class-specific
// tint applies.
export const DEFAULT_PLAYER_TINT: PlayerPlaceholderTint = {
  torsoColor: 0x4a9eff,
  shoulderColor: 0x78bbff,
  legsColor: 0x2f6fb5,
  ringStrokeColor: 0x8fd4ff,
};

const CLASS_TINTS: Readonly<Record<CharacterClassKey, PlayerPlaceholderTint>> = {
  gravewalker: {
    torsoColor: 0x6a4a9e,
    shoulderColor: 0x8f78bb,
    legsColor: 0x4a2f6f,
    ringStrokeColor: 0xc79fff,
  },
  ironclad: {
    torsoColor: 0xb5622f,
    shoulderColor: 0xd49a5a,
    legsColor: 0x7a3f1a,
    ringStrokeColor: 0xffcf9f,
  },
};

export function resolvePlayerTint(classKey: CharacterClassKey | undefined): PlayerPlaceholderTint {
  if (classKey === undefined) {
    return DEFAULT_PLAYER_TINT;
  }
  return CLASS_TINTS[classKey] ?? DEFAULT_PLAYER_TINT;
}
