/**
 * Task 285 — World Interaction Intent Model
 *
 * Defines the discriminated union of all player world interactions
 * that can be triggered from pointer input. Each intent represents
 * a distinct player action the client can request from the server.
 *
 * ## Intent Flow
 *
 *   1. Pointer event fires on the world input zone
 *   2. `resolveWorldInteraction()` maps the pointer context to a single intent
 *   3. `dispatchWorldInteraction()` sends the appropriate network message
 *   4. Server validates and executes the action authoritatively
 *
 * This separation keeps click-resolution logic (what did the player click?)
 * distinct from dispatch logic (what network call do we make?) and from
 * rendering (what does the UI show?).
 *
 * Future tasks (move-then-act, queued actions) can extend the intent types
 * and resolution logic without scattering changes across the area view.
 */

// ---------------------------------------------------------------------------
// Intent types
// ---------------------------------------------------------------------------

/**
 * Ground movement — the player clicked on empty ground to move there.
 */
export interface MoveIntent {
  readonly kind: "move";
  /** Target world-space X coordinate (integer, server-validated). */
  readonly targetX: number;
  /** Target world-space Y coordinate (integer, server-validated). */
  readonly targetY: number;
}

/**
 * Melee/ranged attack — the player clicked on a living enemy.
 * If the enemy is out of attack range, the client should move toward
 * the enemy position first, then send the attack once in range.
 */
export interface AttackEnemyIntent {
  readonly kind: "attack_enemy";
  /** Server-authoritative enemy ID to attack. */
  readonly enemyId: string;
  /** World-space X of the enemy at click time (for range check + movement target). */
  readonly worldX: number;
  /** World-space Y of the enemy at click time (for range check + movement target). */
  readonly worldY: number;
}

/**
 * Skill use — the player right-clicked on an enemy to use the equipped skill
 * (currently Grave Spark).
 */
export interface SkillEnemyIntent {
  readonly kind: "skill_enemy";
  /** Server-authoritative enemy ID to target with skill. */
  readonly enemyId: string;
}

/**
 * Loot pickup — the player clicked on a world loot drop.
 */
export interface PickupLootIntent {
  readonly kind: "pickup_loot";
  /** Server-authoritative loot instance ID. */
  readonly worldLootId: string;
  /** World-space X of the loot drop at click time (for range check + movement target). */
  readonly worldX: number;
  /** World-space Y of the loot drop at click time (for range check + movement target). */
  readonly worldY: number;
}

/**
 * Corpse recovery — the player clicked on their own corpse.
 * If `inRange` is false the client should move toward the corpse first;
 * the server will not accept corpse recovery from too far away.
 */
export interface CorpseRecoverIntent {
  readonly kind: "corpse_recover";
  /** World X of the corpse. */
  readonly worldX: number;
  /** World Y of the corpse. */
  readonly worldY: number;
  /** Whether the player is already in interaction range. */
  readonly inRange: boolean;
}

/**
 * Object/NPC interaction — the player clicked on an interactable world object
 * (vendor stall, service station, etc.).
 * If the interactable is out of range, the client should move toward the
 * object position first, then send the interaction once in range.
 */
export interface InteractObjectIntent {
  readonly kind: "interact_object";
  /** Server-authoritative interactable object ID. */
  readonly objectId: string;
  /** World-space X of the interactable at click time (for range check + movement target). */
  readonly worldX: number;
  /** World-space Y of the interactable at click time (for range check + movement target). */
  readonly worldY: number;
}

/**
 * Union of all possible world interaction intents.
 * The `kind` field is the discriminator.
 */
export type WorldInteractionIntent =
  | MoveIntent
  | AttackEnemyIntent
  | SkillEnemyIntent
  | PickupLootIntent
  | CorpseRecoverIntent
  | InteractObjectIntent;

// ---------------------------------------------------------------------------
// Hit-test result types (returned by screen-space hit-test helpers)
// ---------------------------------------------------------------------------

export interface HitTestEnemy {
  readonly id: string;
  readonly worldX: number;
  readonly worldY: number;
}

export interface HitTestLoot {
  readonly id: string;
  readonly worldX: number;
  readonly worldY: number;
}

export interface HitTestCorpse {
  readonly worldX: number;
  readonly worldY: number;
  readonly inRange: boolean;
}

export interface HitTestInteractable {
  readonly objectId: string;
  readonly worldX: number;
  readonly worldY: number;
}

// ---------------------------------------------------------------------------
// Pointer context (what the resolver needs to decide the intent)
// ---------------------------------------------------------------------------

/**
 * All data the resolver needs to turn a pointer event into a
 * WorldInteractionIntent. Kept as a plain data object so the resolver
 * is a pure function — easy to test, no side-effects.
 */
export interface WorldInteractionPointerContext {
  /** Whether the right mouse button was pressed. */
  readonly isRightButton: boolean;
  /** Hit-test results for the pointer position. In priority order. */
  readonly enemy: HitTestEnemy | null;
  readonly loot: HitTestLoot | null;
  readonly corpse: HitTestCorpse | null;
  readonly interactable: HitTestInteractable | null;
  /** Projected world-space target for ground clicks (null if outside viewport). */
  readonly groundTarget: { readonly targetX: number; readonly targetY: number } | null;
}