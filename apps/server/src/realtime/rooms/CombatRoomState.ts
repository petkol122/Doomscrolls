import { Schema, type, MapSchema } from "@colyseus/schema";
import type { ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";

/**
 * Colyseus schema/state for CombatRoom.
 *
 * Mirrors the minimal `TownRoomState` shell so client presence readers
 * (`getTownRoomPresence` family of helpers) can be reused once a combat
 * join succeeds. The CombatRoom currently exposes only the identity /
 * presence slice — no enemy list, no map, no movement, no combat, no
 * loot, no interactables, no objectives.
 *
 * Contains:
 *  - roomKind (always "combat")
 *  - zoneId   (the zone this room instance belongs to)
 *  - playerPresence (MapSchema keyed by sessionId)
 *  - connectedPlayerCount (reflecting playerPresence.size)
 *
 * Future dedicated tasks (Task 264+, CombatRoom real wiring) are expected
 * to extend this schema with the actual combat/enemy/loot state without
 * duplicating `TownRoom`'s gameplay logic.
 *
 * Task 263 — CombatRoom foundation without duplicate gameplay.
 */
export class CombatRoomState extends Schema {
  @type("string") public roomKind: string = "combat";
  @type("string") public zoneId: ZoneId;
  @type({ map: PlayerPresence }) public playerPresence = new MapSchema<PlayerPresence>();
  @type("number") public connectedPlayerCount: number = 0;

  constructor(zoneId: ZoneId) {
    super();
    this.zoneId = zoneId;
  }
}
