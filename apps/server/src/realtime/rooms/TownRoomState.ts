import { Schema, type, MapSchema } from "@colyseus/schema";
import type { ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { Interactable } from "./Interactable";
import { EnemyPresence } from "@doomscrolls/shared";
import { WorldLoot } from "./WorldLoot";

/**
 * Colyseus schema/state for TownRoom.
 *
 * Contains:
 *  - roomKind (always "town")
 *  - zoneId  (the zone this room instance belongs to)
 *  - playerPresence (MapSchema keyed by sessionId)
 *  - connectedPlayerCount (reflecting playerPresence.size)
 *  - interactables (MapSchema of Interactable objects keyed by id)
 *
 * No position, movement, map, combat, chat, or gameplay.
 * Task 021.1 / 022.1 — TownRoom State + Player Presence.
 * Task 057 — Interactable Object Foundation Batch.
 */
export class TownRoomState extends Schema {
  @type("string") public roomKind: string = "town";
  @type("string") public zoneId: ZoneId;
  @type({ map: PlayerPresence }) public playerPresence = new MapSchema<PlayerPresence>();
  @type("number") public connectedPlayerCount: number = 0;
  @type({ map: Interactable }) public interactables = new MapSchema<Interactable>();
  @type({ map: EnemyPresence }) public enemies = new MapSchema<EnemyPresence>();
  @type({ map: WorldLoot }) public worldLoot = new MapSchema<WorldLoot>();

  constructor(zoneId: ZoneId) {
    super();
    this.zoneId = zoneId;
  }
}
