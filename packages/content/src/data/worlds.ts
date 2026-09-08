import type { WorldContentDefinition } from "./types";

// Core 0.32 — World Map Foundation. Exactly one entry: proves the
// hierarchy holds end to end, not because any current feature reads a
// world-level property. See docs/CORE_BUILD_0_32_PLAN.md.
export const worlds = [
  {
    id: "earth",
    nameKey: "world.earth.name",
    descriptionKey: "world.earth.description"
  }
] as const satisfies readonly WorldContentDefinition[];
