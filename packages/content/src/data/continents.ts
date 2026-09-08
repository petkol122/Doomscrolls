import type { ContinentContentDefinition } from "./types";

// Core 0.32 — World Map Foundation. Exactly one entry: proves the
// hierarchy holds end to end, not because any current feature reads a
// continent-level property. See docs/CORE_BUILD_0_32_PLAN.md.
export const continents = [
  {
    id: "europe",
    worldId: "earth",
    nameKey: "continent.europe.name",
    descriptionKey: "continent.europe.description"
  }
] as const satisfies readonly ContinentContentDefinition[];
