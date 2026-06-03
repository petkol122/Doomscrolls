import { Schema, type } from "@colyseus/schema";
import type { ZoneId } from "@doomscrolls/shared";

/**
 * Minimal Colyseus schema/state for TownRoom.
 *
 * Contains only:
 *  - roomKind (always "town")
 *  - zoneId  (the zone this room instance belongs to)
 *  - connectedPlayerCount (tracked on join/leave)
 *
 * No player entity list, no map, no movement, no gameplay.
 * Task 021.1 — TownRoom Minimal State Schema.
 */
export class TownRoomState extends Schema {
  @type("string") public roomKind: string = "town";
  @type("string") public zoneId: ZoneId;
  @type("number") public connectedPlayerCount: number = 0;

  constructor(zoneId: ZoneId) {
    super();
    this.zoneId = zoneId;
  }
}
