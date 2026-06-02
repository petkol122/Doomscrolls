import type { PassiveContentDefinition } from "./types";

export const passives = [
  {
    id: "nightvision",
    nameKey: "passive.nightvision.name",
    descriptionKey: "passive.nightvision.description"
  }
] as const satisfies readonly PassiveContentDefinition[];