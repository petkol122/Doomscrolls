import { Schema, type, MapSchema } from "@colyseus/schema";
import { EnemyPresence, ProjectilePresence, GroundEffectPresence, TurretPresence, type ZoneId } from "@doomscrolls/shared";
import { PlayerPresence } from "./PlayerPresence";
import { Interactable } from "./Interactable";
import { WorldLoot } from "./WorldLoot";

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
 *  - interactables (MapSchema keyed by interactable id)
 */
export class CombatRoomState extends Schema {
  @type("string") public roomKind: string = "combat";
  @type("string") public zoneId: ZoneId;
  @type({ map: PlayerPresence }) public playerPresence = new MapSchema<PlayerPresence>();
  @type("number") public connectedPlayerCount: number = 0;
  @type({ map: EnemyPresence }) public enemies = new MapSchema<EnemyPresence>();
  @type({ map: Interactable }) public interactables = new MapSchema<Interactable>();
  @type({ map: WorldLoot }) public worldLoot = new MapSchema<WorldLoot>();
  // Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted
  // AoE Skills.
  @type({ map: ProjectilePresence }) public projectiles = new MapSchema<ProjectilePresence>();
  @type({ map: GroundEffectPresence }) public groundEffects = new MapSchema<GroundEffectPresence>();
  // Milestone 0.3 -- Netrunner Urban-Magic Class Archetype.
  @type({ map: TurretPresence }) public turrets = new MapSchema<TurretPresence>();

  constructor(zoneId: ZoneId) {
    super();
    this.zoneId = zoneId;
  }
}
