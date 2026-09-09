import type { AreaContentDefinition } from "./types";

// Core 0.32 — World Map Foundation. Pilsen (Plzeň) is the one real
// area this build proves the architecture with -- Namesti Republiky
// + 4 combat zones live under it (see zones.ts's `areaId` field).
// Coordinates are the real city center (WGS84), matching the
// feasibility spike in docs/CORE_BUILD_0_32_PLAN.md.
export const areas = [
  {
    id: "pilsen",
    continentId: "europe",
    nameKey: "area.pilsen.name",
    descriptionKey: "area.pilsen.description",
    latitude: 49.7384,
    longitude: 13.3736
  }
] as const satisfies readonly AreaContentDefinition[];
