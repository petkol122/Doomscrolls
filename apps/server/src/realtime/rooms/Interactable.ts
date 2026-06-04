import { Schema, type } from "@colyseus/schema";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Colyseus schema for interactable world objects.
 * Synced to clients for rendering and interaction.
 */
export class Interactable extends Schema {
  @type("string") public id: string = "";
  @type("string") public type: string = "";
  @type("string") public label: string = "";
  @type("number") public x: number = 0;
  @type("number") public y: number = 0;

  constructor(id: string, type: string, label: string, x: number, y: number) {
    super();
    this.id = id;
    this.type = type;
    this.label = label;
    this.x = x;
    this.y = y;
  }
}
