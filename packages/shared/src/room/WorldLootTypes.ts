import type { ItemDefinitionId } from "../ids";

export type WorldLootId = string;

/**
 * WorldLoot represents an item that an enemy dropped on the ground.
 *
 * Core 0.1 only supports a few loot kinds, all of which flow through
 * the same pick-up pipeline:
 *  - item: a real {@link ItemDefinitionId} to be added to inventory
 *  - currency: a copper amount to be added to the character's
 *    moneyCopper total. `currencyCopper` is required when `itemId`
 *    is empty; both flags are mutually exclusive in practice.
 */
export interface WorldLoot {
  readonly id: WorldLootId;
  readonly itemId: ItemDefinitionId;
  readonly label: string;
  readonly rarity?: string;
  readonly currencyCopper?: number;
  readonly x: number;
  readonly y: number;
  /**
   * Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix
   * Engine. The instance-level roll made at drop time (see
   * `affixRollEngine.ts`), carried through to pickup so it persists
   * unchanged onto the resulting `ItemInstance`. Empty/"[]" for
   * currency loot.
   */
  readonly rarityTier?: string;
  readonly rolledAffixesJson?: string;
}
