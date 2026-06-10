/**
 * Task 285 — World Interaction Resolver
 *
 * Pure function that maps a pointer context (what the player clicked on)
 * to a concrete WorldInteractionIntent. No side-effects, no network calls.
 *
 * ## Resolution priority (left-click)
 *
 *   1. Enemy (living)       → AttackEnemyIntent
 *   2. Loot drop            → PickupLootIntent
 *   3. Own corpse           → CorpseRecoverIntent (inRange flag set by caller)
 *   4. Interactable object  → InteractObjectIntent
 *   5. Empty ground         → MoveIntent
 *
 * ## Right-click
 *
 *   1. Enemy → SkillEnemyIntent (Grave Spark)
 *   2. Anything else → null (no skill target)
 *
 * Priority order matters: enemies block loot beneath them, etc.
 */

import type {
  WorldInteractionIntent,
  WorldInteractionPointerContext,
} from "./WorldInteractionIntent";

/**
 * Resolve a pointer context to a single world interaction intent.
 *
 * Returns `null` when the pointer context does not map to any actionable
 * intent (e.g. right-click on empty ground, or no ground target available).
 */
export function resolveWorldInteraction(
  ctx: WorldInteractionPointerContext,
): WorldInteractionIntent | null {
  // --- Right-click: skill on enemy only ---
  if (ctx.isRightButton) {
    if (ctx.enemy !== null) {
      return { kind: "skill_enemy", enemyId: ctx.enemy.id };
    }
    // Right-click on anything else has no action yet.
    return null;
  }

  // --- Left-click priority chain ---
  if (ctx.enemy !== null) {
    return {
      kind: "attack_enemy",
      enemyId: ctx.enemy.id,
      worldX: ctx.enemy.worldX,
      worldY: ctx.enemy.worldY,
    };
  }
  if (ctx.loot !== null) {
    return {
      kind: "pickup_loot",
      worldLootId: ctx.loot.id,
      worldX: ctx.loot.worldX,
      worldY: ctx.loot.worldY,
    };
  }
  if (ctx.corpse !== null) {
    return {
      kind: "corpse_recover",
      worldX: ctx.corpse.worldX,
      worldY: ctx.corpse.worldY,
      inRange: ctx.corpse.inRange,
    };
  }
  if (ctx.interactable !== null) {
    return {
      kind: "interact_object",
      objectId: ctx.interactable.objectId,
      worldX: ctx.interactable.worldX,
      worldY: ctx.interactable.worldY,
    };
  }
  if (ctx.groundTarget !== null) {
    return {
      kind: "move",
      targetX: ctx.groundTarget.targetX,
      targetY: ctx.groundTarget.targetY,
    };
  }

  return null;
}