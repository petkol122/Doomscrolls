import type { CharacterClassContentDefinition } from "./types";

export const classes = [
  {
    id: "gravewalker",
    nameKey: "class.gravewalker.name",
    descriptionKey: "class.gravewalker.description",
    startingSkillId: "heavy_strike",
    // Core 0.7 — right-click ("secondary") and hotkey ("tertiary")
    // combat skill slots, content-driven per class.
    secondarySkillId: "grave_spark",
    tertiarySkillId: "bone_splinter",
    baseStats: { power: 3, speed: 1, mind: 2, toughness: 3 }
  },
  {
    // Core 0.9 — Ironclad: a close-range physical bruiser, contrasting
    // Gravewalker's longer-range caster-ish lean. Tankier and slower
    // (higher power/toughness, no speed/mind) with a melee-flavored
    // secondary/tertiary skill pair (shatter_blow/groundbreaker).
    id: "ironclad",
    nameKey: "class.ironclad.name",
    descriptionKey: "class.ironclad.description",
    startingSkillId: "heavy_strike",
    secondarySkillId: "shatter_blow",
    tertiarySkillId: "groundbreaker",
    baseStats: { power: 4, speed: 0, mind: 0, toughness: 5 }
  },
  {
    // Milestone 0.3 -- Netrunner: a techwear operative leaning on
    // Mind/Tech scaling (malware DoTs, an automated turret) rather than
    // raw physical power -- highest mind of any class, at Gravewalker's
    // speed and noticeably less toughness/power than either melee class,
    // trading durability for higher mana/energy-driven sustained output.
    id: "netrunner",
    nameKey: "class.netrunner.name",
    descriptionKey: "class.netrunner.description",
    startingSkillId: "heavy_strike",
    secondarySkillId: "malware_surge",
    tertiarySkillId: "overclock_turret",
    baseStats: { power: 1, speed: 1, mind: 4, toughness: 2 }
  },
  {
    // Milestone 0.3 -- Street Alchemist: an underground chemist mixing
    // volatile aerosol sprays and adrenaline stims. Balanced stats across
    // power/toughness/mind (contrasting the other three classes, which
    // each lean hard into one or two stats) since its identity comes
    // from its skill kit -- an AoE debuff spray plus a self-buff -- not
    // from stacking a single stat.
    id: "street_alchemist",
    nameKey: "class.street_alchemist.name",
    descriptionKey: "class.street_alchemist.description",
    startingSkillId: "heavy_strike",
    secondarySkillId: "aerosol_flash",
    tertiarySkillId: "adrenaline_stim",
    baseStats: { power: 2, speed: 1, mind: 2, toughness: 2 }
  }
] as const satisfies readonly CharacterClassContentDefinition[];