import type { OriginContentDefinition } from "./types";

export const origins = [
  {
    id: "sewer_dweller",
    nameKey: "origin.sewer_dweller.name",
    descriptionKey: "origin.sewer_dweller.description",
    passiveIds: ["nightvision"],
    startingZoneId: "nightmarket",
    allowedClassIds: ["gravewalker", "ironclad"],
    baseStats: { power: 1, speed: 2, mind: 1, toughness: 2 }
  }
] as const satisfies readonly OriginContentDefinition[];