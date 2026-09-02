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
    baseDamage: 3
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
    baseDamage: 3
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
    baseDamage: 5
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
    baseDamage: 6
  },
  {
    // Core 0.9 — Ironclad's tertiary skill. The heaviest single hit
    // in the game, at the slowest cooldown, rewarding a player who
    // commits to melee range rather than kiting.
    id: "groundbreaker",
    nameKey: "skill.groundbreaker.name",
    descriptionKey: "skill.groundbreaker.description",
    targeting: "target",
    range: 80,
    cooldownMs: 3200,
    baseDamage: 10
  }
] as const satisfies readonly SkillContentDefinition[];