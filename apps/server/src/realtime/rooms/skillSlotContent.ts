import { contentRegistry } from "@doomscrolls/content";
import type { CharacterClassKey } from "@doomscrolls/shared";
import type { PlayerPresence } from "./PlayerPresence";

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
 */
export type SkillSlotId = "secondary" | "tertiary";

export interface SkillSlotDefinition {
  readonly skillId: string;
  readonly range: number;
  readonly damage: number;
  readonly cooldownMs: number;
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
  const skillId = slot === "secondary" ? characterClass.secondarySkillId : characterClass.tertiarySkillId;
  const skill = contentRegistry.skills.require(skillId);

  return {
    skillId: skill.id,
    range: skill.range,
    damage: skill.baseDamage,
    cooldownMs: skill.cooldownMs,
  };
}

export function getSkillSlotCooldownAt(player: PlayerPresence, slot: SkillSlotId): number {
  const value = slot === "secondary" ? player.nextSkillSlotAt : player.nextTertiarySkillSlotAt;
  return Number.isFinite(value) ? value : 0;
}

export function setSkillSlotCooldownAt(player: PlayerPresence, slot: SkillSlotId, value: number): void {
  if (slot === "secondary") {
    player.nextSkillSlotAt = value;
  } else {
    player.nextTertiarySkillSlotAt = value;
  }
}

export function pendingActionTypeForSkillSlot(slot: SkillSlotId): "skill_secondary" | "skill_tertiary" {
  return slot === "secondary" ? "skill_secondary" : "skill_tertiary";
}

export function skillSlotForPendingActionType(actionType: string): SkillSlotId | null {
  if (actionType === "skill_secondary") {
    return "secondary";
  }
  if (actionType === "skill_tertiary") {
    return "tertiary";
  }
  return null;
}
