import { Schema, type, MapSchema } from "@colyseus/schema";
import { EnemyPresence, type ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";

/**
 * Colyseus schema/state for CombatRoom.
 *
 * Task 263 foundation: minimal identity / presence slice.
 * Task 268 (minimal real combat wiring) extension: an `enemies`
 * MapSchema is added so the same shared `EnemyPresence` schema and
 * `validateAttackIntent` / `applyEnemyDamage` helpers used by
 * `TownRoom` are reusable here. The state shape stays intentionally
 * narrow and does not add interactables, world loot, vendors or
 * objectives.
 *
 * Contains:
 *  - roomKind (always "combat")
 *  - zoneId   (the zone this room instance belongs to)
 *  - playerPresence (MapSchema keyed by sessionId)
 *  - connectedPlayerCount (reflecting playerPresence.size)
 *  - enemies (MapSchema keyed by enemy instance id)
 */
export class CombatRoomState extends Schema {
  @type("string") public roomKind: string = "combat";
  @type("string") public zoneId: ZoneId;
  @type({ map: PlayerPresence }) public playerPresence = new MapSchema<PlayerPresence>();
  @type("number") public connectedPlayerCount: number = 0;
  @type({ map: EnemyPresence }) public enemies = new MapSchema<EnemyPresence>();

  constructor(zoneId: ZoneId) {
    super();
    this.zoneId = zoneId;
  }
}
