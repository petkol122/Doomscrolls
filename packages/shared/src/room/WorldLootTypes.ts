import type { ItemDefinitionId } from "../ids";

export type WorldLootId = string;

export interface WorldLoot {
  readonly id: WorldLootId;
  readonly itemId: ItemDefinitionId;
  readonly label: string;
  readonly rarity?: string;
  readonly x: number;
  readonly y: number;
}
