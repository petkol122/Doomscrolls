import { Schema, type } from "@colyseus/schema";
import type { ItemDefinitionId, WorldLootId } from "@doomscrolls/shared";

export class WorldLoot extends Schema {
  @type("string") public id: WorldLootId;
  @type("string") public itemId: ItemDefinitionId;
  @type("string") public label: string;
  @type("string") public rarity: string;
  @type("number") public x: number;
  @type("number") public y: number;

  constructor(id: WorldLootId, itemId: ItemDefinitionId, label: string, rarity: string, x: number, y: number) {
    super();
    this.id = id;
    this.itemId = itemId;
    this.label = label;
    this.rarity = rarity;
    this.x = x;
    this.y = y;
  }
}
