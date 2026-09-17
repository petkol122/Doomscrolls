import type { SkillContentDefinition } from "./types";

export const skills = [
  {
    id: "heavy_strike",
    nameKey: "skill.heavy_strike.name",
    descriptionKey: "skill.heavy_strike.description",
    targeting: "target",
    // Core 0.14 -- fixed from 1.4: this was authored in a different unit
    // than every other skill's range (grave_spark 96, bone_splinter 140,
    // shatter_blow 64, groundbreaker 80, all world-space pixels).
    // heavy_strike was never resolved by any input path before 0.14, so
    // the mismatch went unnoticed; left at 1.4 it would fail every
    // realistic-distance cast as "out_of_range". 64 matches
    // shatter_blow, the other melee-flavored skill -- a unit-consistency
    // fix, not a balance change (baseDamage/cooldownMs are untouched).
    range: 64,
    cooldownMs: 1000,
    baseDamage: 3,
    // Core 0.1 Foundation -- the universal starting skill is free to
    // cast (basic-attack flavor); only the class-specific secondary/
    // tertiary slots draw from the mana pool.
    manaCost: 0,
    maxRank: 5,
    damagePerRank: 1
  },
  {
    // Core 0.7 — lifted out of the previously-hardcoded GRAVE_SPARK_*
    // constants in TownRoom.ts/deferredActionExecution.ts so the
    // secondary skill slot resolves its numbers from content like
    // everything else, instead of a hand-written duplicate per room.
    id: "grave_spark",
    nameKey: "skill.grave_spark.name",
    descriptionKey: "skill.grave_spark.description",
    targeting: "target",
    range: 96,
    cooldownMs: 1500,
    baseDamage: 3,
    manaCost: 12,
    maxRank: 5,
    damagePerRank: 2,
    // Core 0.2 — a jolt of grave energy saps the target's footing.
    appliesEffect: "slow",
    effectDurationMs: 2500,
    effectMagnitude: 0.35
  },
  {
    // Core 0.7 — new tertiary skill slot. Longer range and a harder
    // hit than Grave Spark, at a slower cadence, so the two slots
    // feel distinct rather than interchangeable.
    id: "bone_splinter",
    nameKey: "skill.bone_splinter.name",
    descriptionKey: "skill.bone_splinter.description",
    targeting: "target",
    range: 140,
    cooldownMs: 2600,
    baseDamage: 5,
    manaCost: 20,
    maxRank: 5,
    damagePerRank: 3,
    // Core 0.2 — a lodged bone splinter draws blood over time.
    appliesEffect: "bleed",
    effectDurationMs: 4000,
    effectMagnitude: 2,
    // Milestone 0.2 — travels to its target instead of hitting instantly;
    // still single-target via targetEnemyId, just with real flight time.
    isProjectile: true,
    projectileSpeed: 480
  },
  {
    // Core 0.9 — Ironclad's secondary skill. Short (melee) range and
    // a bigger single hit than Grave Spark, at a shorter cooldown —
    // a close-range, high-commitment burst identity contrasting
    // Gravewalker's longer-range poke.
    id: "shatter_blow",
    nameKey: "skill.shatter_blow.name",
    descriptionKey: "skill.shatter_blow.description",
    targeting: "target",
    range: 64,
    cooldownMs: 1300,
    baseDamage: 6,
    manaCost: 12,
    maxRank: 5,
    damagePerRank: 2,
    // Core 0.2 — a shattering blow briefly reels the target.
    appliesEffect: "stun",
    effectDurationMs: 700,
    effectMagnitude: 0
  },
  {
    // Core 0.9 — Ironclad's tertiary skill. The heaviest single hit
    // in the game, at the slowest cooldown, rewarding a player who
    // commits to melee range rather than kiting.
    id: "groundbreaker",
    nameKey: "skill.groundbreaker.name",
    descriptionKey: "skill.groundbreaker.description",
    // Milestone 0.2 — ground-targeted AoE slam: `range` is now the max
    // distance from caster to the targeted ground point, not to an enemy.
    targeting: "ground_aoe",
    range: 80,
    cooldownMs: 3200,
    baseDamage: 10,
    manaCost: 22,
    maxRank: 5,
    damagePerRank: 3,
    // Core 0.2 — the ground-shattering slam stuns anyone caught in it.
    appliesEffect: "stun",
    effectDurationMs: 1400,
    effectMagnitude: 0,
    aoeRadius: 90
  },
  {
    // Milestone 0.3 -- Netrunner's secondary skill. A targeted deck-rig
    // projectile that lodges an EMP payload in its target, disrupting
    // their systems with a damage-over-time effect distinct from the
    // physical bleed/burn DoTs -- same shape as Bone Splinter otherwise.
    id: "malware_surge",
    nameKey: "skill.malware_surge.name",
    descriptionKey: "skill.malware_surge.description",
    targeting: "target",
    range: 130,
    cooldownMs: 2200,
    baseDamage: 4,
    manaCost: 18,
    maxRank: 5,
    damagePerRank: 2,
    appliesEffect: "emp_dot",
    effectDurationMs: 4000,
    effectMagnitude: 2,
    isProjectile: true,
    projectileSpeed: 520
  },
  {
    // Milestone 0.3 -- Netrunner's tertiary skill. A ground-targeted
    // deployment instead of an instant AoE slam: drops a stationary
    // turret that auto-fires at nearby enemies for its lifespan.
    // `aoeRadius` doubles as the turret's attack range and `baseDamage`/
    // `damagePerRank` as its per-shot damage (see `SkillContentDefinition.
    // spawnsTurret`).
    id: "overclock_turret",
    nameKey: "skill.overclock_turret.name",
    descriptionKey: "skill.overclock_turret.description",
    targeting: "ground_aoe",
    range: 100,
    cooldownMs: 8000,
    baseDamage: 3,
    manaCost: 30,
    maxRank: 5,
    damagePerRank: 1,
    aoeRadius: 140,
    spawnsTurret: true,
    turretDurationMs: 6000,
    turretAttackIntervalMs: 800
  },
  {
    // Milestone 0.3 -- Street Alchemist's secondary skill. A cone/AoE
    // chemical spray resolved as a ground-targeted radius (matching how
    // every other AoE skill in this content set is modeled) that burns
    // and slows everyone it catches -- Burn as the primary effect,
    // Slow as a `appliesSecondaryEffect` layered on top.
    id: "aerosol_flash",
    nameKey: "skill.aerosol_flash.name",
    descriptionKey: "skill.aerosol_flash.description",
    targeting: "ground_aoe",
    range: 90,
    cooldownMs: 2800,
    baseDamage: 4,
    manaCost: 16,
    maxRank: 5,
    damagePerRank: 2,
    appliesEffect: "burn",
    effectDurationMs: 3000,
    effectMagnitude: 2,
    appliesSecondaryEffect: "slow",
    secondaryEffectDurationMs: 2000,
    secondaryEffectMagnitude: 0.3,
    aoeRadius: 85
  },
  {
    // Milestone 0.3 -- Street Alchemist's tertiary skill. A self-targeted
    // adrenaline stim: no enemy/ground point, just an instant self-buff
    // (see `SkillTargetingMode.self_buff`) raising attack speed and
    // movement speed for 6 seconds via the new "haste" status effect.
    id: "adrenaline_stim",
    nameKey: "skill.adrenaline_stim.name",
    descriptionKey: "skill.adrenaline_stim.description",
    targeting: "self_buff",
    range: 0,
    cooldownMs: 14000,
    baseDamage: 0,
    manaCost: 24,
    maxRank: 5,
    damagePerRank: 0,
    appliesEffect: "haste",
    effectDurationMs: 6000,
    effectMagnitude: 0.3
  }
] as const satisfies readonly SkillContentDefinition[];
