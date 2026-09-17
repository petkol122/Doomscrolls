import { contentRegistry } from "@doomscrolls/content";
import type { SkillTargetingMode } from "@doomscrolls/content";
import type { CharacterClassKey } from "@doomscrolls/shared";
import type { PlayerPresence } from "./PlayerPresence";
import { applyStatusEffect } from "./statusEffects";

/**
 * Core 0.7 -- content-driven skill slot resolution.
 *
 * Replaces the previously-hardcoded GRAVE_SPARK_RANGE/DAMAGE/COOLDOWN_MS
 * constants (duplicated in TownRoom.ts and deferredActionExecution.ts)
 * with a lookup against `skills.ts` content, keyed by the class's
 * `secondarySkillId` / `tertiarySkillId`. This is also what lets
 * CombatRoom register a skill-slot handler at all -- previously
 * `request_use_skill_slot` was only handled in TownRoom.ts, so neither
 * skill could be cast in Blackwire Sewers or Static Yard.
 *
 * Core 0.9 -- now resolves per the joined character's own class (see
 * `resolveSkillSlotDefinition` below) instead of the single-class
 * hardcoded default this module originally shipped with.
 *
 * Core 0.14 -- added a third slot, "primary", resolving to the class's
 * `startingSkillId` (`heavy_strike` for both current classes). This is
 * the same content field every class definition already carried but
 * that no input path had ever resolved.
 */
export type SkillSlotId = "primary" | "secondary" | "tertiary";

export interface SkillSlotDefinition {
  readonly skillId: string;
  readonly range: number;
  readonly damage: number;
  readonly cooldownMs: number;
  /** Core 0.1 Foundation -- mana cost deducted before a cast is accepted. */
  readonly manaCost: number;
  readonly maxRank: number;
  readonly damagePerRank: number;
  /**
   * Core 0.2 -- Status Effects & Debuff System. Optional status effect
   * this skill applies to its target on a successful cast, alongside its
   * own damage. Absent = damage-only, unchanged pre-0.2 behavior.
   */
  readonly appliesEffect?: "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste";
  readonly effectDurationMs?: number;
  readonly effectMagnitude?: number;
  /**
   * Milestone 0.3 -- Street Alchemist Class Archetype. Optional second
   * status effect applied alongside `appliesEffect` (see
   * `SkillContentDefinition.appliesSecondaryEffect`).
   */
  readonly appliesSecondaryEffect?: "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste";
  readonly secondaryEffectDurationMs?: number;
  readonly secondaryEffectMagnitude?: number;
  /**
   * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted
   * AoE Skills. `targeting` decides whether the cast handler expects a
   * `targetEnemyId` ("target"), a ground point ("ground_aoe"), or neither
   * ("self_buff" -- see `SkillTargetingMode`); `isProjectile`/
   * `projectileSpeed` mark a "target" skill as travel-time; `aoeRadius`
   * is set only for "ground_aoe" skills.
   */
  readonly targeting: SkillTargetingMode;
  readonly isProjectile?: boolean;
  readonly projectileSpeed?: number;
  readonly aoeRadius?: number;
  /**
   * Milestone 0.3 -- Netrunner Urban-Magic Class Archetype. See
   * `SkillContentDefinition.spawnsTurret`.
   */
  readonly spawnsTurret?: boolean;
  readonly turretDurationMs?: number;
  readonly turretAttackIntervalMs?: number;
}

/**
 * Core 0.9 -- resolves the slot's skill from the *joined character's own
 * class*, not a hardcoded default. Before this, every class would have
 * silently resolved through Gravewalker's skill mapping (the module used
 * to hardcode `DEFAULT_CLASS_ID = "gravewalker"`, dating back to when
 * Core 0.1 had exactly one playable class) -- a second class's players
 * would have been cast as Grave Spark/Bone Splinter regardless of which
 * class they actually joined as.
 */
export function resolveSkillSlotDefinition(
  slot: SkillSlotId,
  classKey: CharacterClassKey,
): SkillSlotDefinition {
  const characterClass = contentRegistry.classes.require(classKey);
  const skillId = slot === "primary"
    ? characterClass.startingSkillId
    : slot === "secondary"
      ? characterClass.secondarySkillId
      : characterClass.tertiarySkillId;
  const skill = contentRegistry.skills.require(skillId);

  return {
    skillId: skill.id,
    range: skill.range,
    damage: skill.baseDamage,
    cooldownMs: skill.cooldownMs,
    manaCost: skill.manaCost,
    maxRank: skill.maxRank,
    damagePerRank: skill.damagePerRank,
    targeting: skill.targeting,
    ...(skill.appliesEffect !== undefined
      ? {
          appliesEffect: skill.appliesEffect,
          effectDurationMs: skill.effectDurationMs,
          effectMagnitude: skill.effectMagnitude,
        }
      : {}),
    ...(skill.appliesSecondaryEffect !== undefined
      ? {
          appliesSecondaryEffect: skill.appliesSecondaryEffect,
          secondaryEffectDurationMs: skill.secondaryEffectDurationMs,
          secondaryEffectMagnitude: skill.secondaryEffectMagnitude,
        }
      : {}),
    ...(skill.isProjectile === true
      ? { isProjectile: true, projectileSpeed: skill.projectileSpeed }
      : {}),
    ...(skill.aoeRadius !== undefined ? { aoeRadius: skill.aoeRadius } : {}),
    ...(skill.spawnsTurret === true
      ? {
          spawnsTurret: true,
          turretDurationMs: skill.turretDurationMs,
          turretAttackIntervalMs: skill.turretAttackIntervalMs,
        }
      : {}),
  };
}

/**
 * Core 0.10 -- combines a skill's own flat `baseDamage` with the caster's
 * power/equipment-derived damage bonus, so weapon choice and the power
 * stat matter for skill casts too, not just basic attacks.
 *
 * `CharacterStatsService.calculateDerivedStats` treats `1` as the
 * universal per-hit floor shared by every damage source
 * (`damage = 1 + power`); everything above that floor is the
 * power-stat/equipment contribution. Subtracting it back out here
 * isolates that bonus so it can be layered onto a skill's own numbers
 * without double-counting the floor, and without skills losing their
 * own identity as the dominant, distinguishing factor between them.
 */
export function resolveSkillCastDamage(
  skillDefinition: Pick<SkillSlotDefinition, "damage">,
  playerDamage: number,
  /**
   * Core 0.1 Foundation -- the caster's current rank in this skill slot
   * (1..maxRank). Each rank above 1 adds `damagePerRank` flat bonus
   * damage. Defaults to 1 (no bonus) so every existing call site that
   * predates skill ranks keeps behaving exactly as before.
   */
  rank: number = 1,
  damagePerRank: number = 0,
): number {
  const damageBonus = Math.max(0, playerDamage - 1);
  const rankBonus = Math.max(0, Math.floor(rank) - 1) * Math.max(0, damagePerRank);
  return skillDefinition.damage + damageBonus + rankBonus;
}

/**
 * Core 0.2 -- applies a skill's optional status effect (see
 * `SkillSlotDefinition.appliesEffect`) to `target` on a successful cast.
 * A no-op when the skill is damage-only. Shared by every skill-cast call
 * site (immediate + deferred move-to-cast, both rooms) so the effect
 * only needs to be defined once in content.
 */
export function applySkillEffectIfDefined(
  target: { statusEffects: string },
  skillDefinition: Pick<
    SkillSlotDefinition,
    | "appliesEffect"
    | "effectDurationMs"
    | "effectMagnitude"
    | "appliesSecondaryEffect"
    | "secondaryEffectDurationMs"
    | "secondaryEffectMagnitude"
  >,
  now: number,
): void {
  if (
    skillDefinition.appliesEffect !== undefined &&
    Number.isFinite(skillDefinition.effectDurationMs) &&
    Number.isFinite(skillDefinition.effectMagnitude)
  ) {
    applyStatusEffect(
      target,
      skillDefinition.appliesEffect,
      now,
      skillDefinition.effectDurationMs as number,
      skillDefinition.effectMagnitude as number,
    );
  }

  // Milestone 0.3 -- Street Alchemist's aerosol_flash layers a second
  // effect (Slow) on top of its primary one (Burn); every other skill
  // leaves this undefined and is unaffected.
  if (
    skillDefinition.appliesSecondaryEffect !== undefined &&
    Number.isFinite(skillDefinition.secondaryEffectDurationMs) &&
    Number.isFinite(skillDefinition.secondaryEffectMagnitude)
  ) {
    applyStatusEffect(
      target,
      skillDefinition.appliesSecondaryEffect,
      now,
      skillDefinition.secondaryEffectDurationMs as number,
      skillDefinition.secondaryEffectMagnitude as number,
    );
  }
}

export function getSkillSlotCooldownAt(player: PlayerPresence, slot: SkillSlotId): number {
  const value = slot === "primary"
    ? player.nextPrimarySkillSlotAt
    : slot === "secondary"
      ? player.nextSkillSlotAt
      : player.nextTertiarySkillSlotAt;
  return Number.isFinite(value) ? value : 0;
}

export function setSkillSlotCooldownAt(player: PlayerPresence, slot: SkillSlotId, value: number): void {
  if (slot === "primary") {
    player.nextPrimarySkillSlotAt = value;
  } else if (slot === "secondary") {
    player.nextSkillSlotAt = value;
  } else {
    player.nextTertiarySkillSlotAt = value;
  }
}

/** Core 0.1 Foundation -- read a player's current rank for a skill slot. */
export function getSkillSlotRank(player: PlayerPresence, slot: SkillSlotId): number {
  const value = slot === "primary"
    ? player.primarySkillRank
    : slot === "secondary"
      ? player.secondarySkillRank
      : player.tertiarySkillRank;
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

export function setSkillSlotRank(player: PlayerPresence, slot: SkillSlotId, rank: number): void {
  if (slot === "primary") {
    player.primarySkillRank = rank;
  } else if (slot === "secondary") {
    player.secondarySkillRank = rank;
  } else {
    player.tertiarySkillRank = rank;
  }
}

/**
 * Core 0.1 Foundation -- whether the player's current mana pool covers
 * a skill's manaCost. A cost of 0 (the primary/basic-attack slot) is
 * always affordable regardless of the pool's current state.
 */
export function hasSufficientMana(player: PlayerPresence, manaCost: number): boolean {
  if (!Number.isFinite(manaCost) || manaCost <= 0) {
    return true;
  }
  return Number.isFinite(player.mana) && player.mana >= manaCost;
}

/** Deducts a skill's manaCost from the player's pool, floored at 0. */
export function deductMana(player: PlayerPresence, manaCost: number): void {
  if (!Number.isFinite(manaCost) || manaCost <= 0) {
    return;
  }
  const current = Number.isFinite(player.mana) ? player.mana : 0;
  player.mana = Math.max(0, current - manaCost);
}

export function pendingActionTypeForSkillSlot(slot: SkillSlotId): "skill_primary" | "skill_secondary" | "skill_tertiary" {
  return slot === "primary" ? "skill_primary" : slot === "secondary" ? "skill_secondary" : "skill_tertiary";
}

export function skillSlotForPendingActionType(actionType: string): SkillSlotId | null {
  if (actionType === "skill_primary") {
    return "primary";
  }
  if (actionType === "skill_secondary") {
    return "secondary";
  }
  if (actionType === "skill_tertiary") {
    return "tertiary";
  }
  return null;
}
