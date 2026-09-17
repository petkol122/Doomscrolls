import type { AffixContentDefinition } from "./types";

/**
 * Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix Engine.
 * Hand-authored pool of rollable prefixes/suffixes; `affixRollEngine.ts`
 * (apps/server) rolls a subset of these onto an item instance at drop
 * time, within their `min..max` range. See `types.ts`'s
 * `AffixContentDefinition` for field docs.
 */
export const affixes = [
  {
    id: "sturdy",
    kind: "prefix",
    nameKey: "affix.sturdy.name",
    target: "maxHp",
    operation: "add",
    min: 10,
    max: 25
  },
  {
    id: "glinting",
    kind: "prefix",
    nameKey: "affix.glinting.name",
    target: "mind",
    operation: "add",
    min: 5,
    max: 15
  },
  {
    id: "heavy",
    kind: "prefix",
    nameKey: "affix.heavy.name",
    target: "damage",
    operation: "add",
    min: 2,
    max: 5
  },
  {
    id: "of_the_fox",
    kind: "suffix",
    nameKey: "affix.of_the_fox.name",
    target: "speed",
    operation: "add",
    min: 2,
    max: 6
  },
  {
    id: "of_iron",
    kind: "suffix",
    nameKey: "affix.of_iron.name",
    target: "armor",
    operation: "add",
    min: 3,
    max: 8
  },
  {
    id: "of_vigor",
    kind: "suffix",
    nameKey: "affix.of_vigor.name",
    target: "toughness",
    operation: "add",
    min: 2,
    max: 5
  }
] as const satisfies readonly AffixContentDefinition[];
