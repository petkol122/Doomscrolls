import { Schema, type } from "@colyseus/schema";
import type { ItemDefinitionId, WorldLootId } from "@doomscrolls/shared";

/**
 * Colyseus schema for a single ground loot drop.
 *
 * Two flavours are supported through the same pickup pipeline:
 *  - item loot: a real {@link ItemDefinitionId} is set, `currencyCopper` is 0.
 *  - currency loot: a copper amount to add to the character's moneyCopper
 *    total. The `itemId` is set to an empty string for currency-only drops.
 *
 * Both flavours are produced by the server and consumed by the
 * `request_pickup_world_loot` handler in {@link TownRoom}.
 */
export class WorldLoot extends Schema {
  @type("string") public id: WorldLootId;
  @type("string") public itemId: ItemDefinitionId;
  @type("string") public label: string;
  @type("string") public rarity: string;
  @type("number") public currencyCopper: number;
  @type("number") public x: number;
  @type("number") public y: number;

  constructor(
    id: WorldLootId,
    itemId: ItemDefinitionId,
    label: string,
    rarity: string,
    x: number,
    y: number,
    currencyCopper = 0,
  ) {
    super();
    this.id = id;
    this.itemId = itemId;
    this.label = label;
    this.rarity = rarity;
    this.currencyCopper = currencyCopper;
    this.x = x;
    this.y = y;
  }
}
