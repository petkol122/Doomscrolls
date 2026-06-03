import { Schema, type, MapSchema } from "@colyseus/schema";
import type { ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";

/**
 * Colyseus schema/state for TownRoom.
 *
 * Contains:
 *  - roomKind (always "town")
 *  - zoneId  (the zone this room instance belongs to)
 *  - playerPresence (MapSchema keyed by sessionId)
 *  - connectedPlayerCount (reflecting playerPresence.size)
 *
 * No position, movement, map, combat, chat, or gameplay.
 * Task 021.1 / 022.1 — TownRoom State + Player Presence.
 */
export class TownRoomState extends Schema {
  @type("string") public roomKind: string = "town";
  @type("string") public zoneId: ZoneId;
  @type({ map: PlayerPresence }) public playerPresence = new MapSchema<PlayerPresence>();
  @type("number") public connectedPlayerCount: number = 0;

  constructor(zoneId: ZoneId) {
    super();
    this.zoneId = zoneId;
  }
}
