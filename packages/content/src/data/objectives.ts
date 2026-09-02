import type { ContentLocalizationKey, ObjectiveContentDefinition } from "./types";

export const objectives: readonly ObjectiveContentDefinition[] = [
  {
    id: "cull_trashboars",
    titleKey: "objective.cull_trashboars.title" as ContentLocalizationKey,
    descriptionKey: "objective.cull_trashboars.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_runt", "trashboar_brute"],
    requiredKills: 3,
    xpReward: 5,
    copperReward: 3,
    zoneId: "nightmarket",
  },
  {
    id: "break_the_brute",
    titleKey: "objective.break_the_brute.title" as ContentLocalizationKey,
    descriptionKey: "objective.break_the_brute.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_brute"],
    requiredKills: 1,
    xpReward: 10,
    copperReward: 6,
    zoneId: "nightmarket",
  },
  {
    id: "sewer_cleanup",
    titleKey: "objective.sewer_cleanup.title" as ContentLocalizationKey,
    descriptionKey: "objective.sewer_cleanup.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_runt", "trashboar_brute"],
    requiredKills: 5,
    xpReward: 8,
    copperReward: 5,
    zoneId: "nightmarket",
  },
  // Core 0.15 -- combat-zone coverage. Kill-progress tracking already
  // fires in CombatRoom (advanceObjectiveProgress is wired into both
  // TownRoom's and CombatRoom's kill paths), but before this build no
  // objective's targetEnemyIds ever included trashboar_skitter or
  // static_wretch -- kills of either enemy, in the game's own dedicated
  // combat zones, advanced nothing. zoneId is display-only (per its own
  // type comment), not a mechanical gate, so this only needed new
  // objective entries, not new mechanics.
  {
    id: "skitter_hunt",
    titleKey: "objective.skitter_hunt.title" as ContentLocalizationKey,
    descriptionKey: "objective.skitter_hunt.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_skitter"],
    requiredKills: 4,
    xpReward: 6,
    copperReward: 4,
    zoneId: "blackwire_sewers",
  },
  {
    id: "static_cleanup",
    titleKey: "objective.static_cleanup.title" as ContentLocalizationKey,
    descriptionKey: "objective.static_cleanup.description" as ContentLocalizationKey,
    targetEnemyIds: ["static_wretch"],
    requiredKills: 4,
    xpReward: 7,
    copperReward: 4,
    zoneId: "static_yard",
  },
  // Core 0.15 -- the `repeatable` field has existed since Core 0.4 and
  // TownRoom.ts's isObjectiveRepeatable/isObjectiveStartBlockedByCompletion
  // already correctly bypass the completion-block for a repeatable
  // objective -- but no objective had ever set repeatable: true, so
  // that path had never actually been exercised by anything, including
  // tests. Reward rate (1.5 xp / 1 copper per kill) matches the existing
  // objectives' established per-kill rate, not a new balance decision.
  {
    id: "sewer_patrol",
    titleKey: "objective.sewer_patrol.title" as ContentLocalizationKey,
    descriptionKey: "objective.sewer_patrol.description" as ContentLocalizationKey,
    targetEnemyIds: ["trashboar_runt"],
    requiredKills: 2,
    xpReward: 3,
    copperReward: 2,
    zoneId: "nightmarket",
    repeatable: true,
  },
  // Core 0.16 -- Cinderworks zone coverage, same shape as 0.15's
  // skitter_hunt/static_cleanup: closes the gap so kills of the zone's
  // own new enemies actually advance something.
  {
    id: "slag_hunt",
    titleKey: "objective.slag_hunt.title" as ContentLocalizationKey,
    descriptionKey: "objective.slag_hunt.description" as ContentLocalizationKey,
    targetEnemyIds: ["slag_hound"],
    requiredKills: 4,
    xpReward: 6,
    copperReward: 4,
    zoneId: "cinderworks",
  },
  {
    id: "foundry_purge",
    titleKey: "objective.foundry_purge.title" as ContentLocalizationKey,
    descriptionKey: "objective.foundry_purge.description" as ContentLocalizationKey,
    targetEnemyIds: ["foundry_warden"],
    requiredKills: 1,
    xpReward: 10,
    copperReward: 6,
    zoneId: "cinderworks",
  },
] as const satisfies readonly ObjectiveContentDefinition[];

/**
 * Ordered sequence of objective IDs offered by the Notice Board.
 * Core 0.15 -- up to two objectives may be active at a time (see
 * PlayerPresence's slot-1/slot-2 fields); a repeatable objective
 * (sewer_patrol) is never blocked by prior completion and stays in the
 * available catalog indefinitely.
 */
export const NOTICE_BOARD_OBJECTIVE_SEQUENCE: readonly string[] = [
  "cull_trashboars",
  "break_the_brute",
  "sewer_cleanup",
  "skitter_hunt",
  "static_cleanup",
  "sewer_patrol",
  "slag_hunt",
  "foundry_purge",
] as const;
