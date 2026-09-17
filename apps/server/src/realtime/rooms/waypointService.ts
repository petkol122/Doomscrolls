import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import type {
  CharacterId,
  WaypointDestinationEntry,
  WaypointOpenedServerMessage,
  WaypointRejectedReason,
  ZoneId,
} from "@doomscrolls/shared";
import { CharacterRepository } from "../../persistence/repositories";
import { isPositionInsideZoneBounds } from "./validateCharacterLocation";
import { COMBAT_SPAWN_BOX } from "./initializeCombatEnemies";

const TOWN_ZONE_ID = "namesti_republiky" as ZoneId;
const TOWN_DEFAULT_SPAWN_ID = "namesti_republiky_spawn";

/**
 * Interior landing position for a fresh combat-zone entry, near the
 * zone's own `combat_return_gate` (the same safe box `CombatRoom`
 * already uses to center a player on respawn -- see
 * `initializeCombatEnemies.ts`).
 */
const COMBAT_ZONE_ENTRY_X = Math.round((COMBAT_SPAWN_BOX.minX + COMBAT_SPAWN_BOX.maxX) / 2);
const COMBAT_ZONE_ENTRY_Y = Math.round((COMBAT_SPAWN_BOX.minY + COMBAT_SPAWN_BOX.maxY) / 2);

/**
 * Core 0.34 — Namesti Republiky has no combat gates or waypoint service
 * yet (deliberately deferred; see the Nightmarket removal/Namesti
 * Republiky build notes). This table is empty until a later build adds
 * real town-side gate/waypoint props for the combat zones again.
 */
interface CombatZoneRoute {
  readonly gateObjectId: string;
  readonly combatZoneId: ZoneId;
  readonly entrySpawnId: string;
  readonly targetSpawnKey: string;
  readonly messageKey: string;
  readonly areaKey: string;
  readonly waypointObjectId?: string;
  readonly waypointId?: string;
  readonly waypointLabelKey?: string;
}

const COMBAT_ZONE_ROUTES: readonly CombatZoneRoute[] = [];

function findRouteByGateObjectId(objectId: string): CombatZoneRoute | undefined {
  return COMBAT_ZONE_ROUTES.find((route) => route.gateObjectId === objectId);
}

function findRouteByCombatZoneId(zoneId: ZoneId): CombatZoneRoute | undefined {
  return COMBAT_ZONE_ROUTES.find((route) => route.combatZoneId === zoneId);
}

/** True when `objectId` is a town-side gate that hands a player off into a combat zone. */
export function isCombatGateObjectId(objectId: string): boolean {
  return findRouteByGateObjectId(objectId) !== undefined;
}

/**
 * Milestone 0.2 — Waypoint & Fast Travel. Unlike the (currently empty,
 * deferred) `COMBAT_ZONE_ROUTES` table above, city waypoint shrines are
 * content-driven: any `WorldPropContentDefinition` of kind `"waypoint"`
 * is a valid fast-travel destination, keyed by its own prop id, landing
 * at its own `x`/`y` in its own `targetZoneId` (a waypoint always sits
 * in the zone it teleports to). This is what lets `namesti_waypoint`
 * and `bory_waypoint` -- two different town zones -- both work without
 * any hand-maintained route table.
 */
interface WaypointDefinition {
  readonly objectId: string;
  readonly waypointId: string;
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly y: number;
  readonly labelKey: string;
}

const WAYPOINT_DEFINITIONS: readonly WaypointDefinition[] = contentRegistry.worldProps.all
  .filter((prop) => prop.kind === "waypoint" && prop.targetZoneId !== undefined)
  .map((prop) => ({
    objectId: prop.id,
    waypointId: prop.id,
    zoneId: prop.targetZoneId as ZoneId,
    x: prop.x,
    y: prop.y,
    labelKey: prop.labelKey ?? `world_prop.${prop.id}.label`,
  }));

function findWaypointByObjectId(objectId: string): WaypointDefinition | undefined {
  return WAYPOINT_DEFINITIONS.find((waypoint) => waypoint.objectId === objectId);
}

function findWaypointById(waypointId: string): WaypointDefinition | undefined {
  return WAYPOINT_DEFINITIONS.find((waypoint) => waypoint.waypointId === waypointId);
}

/** True when `objectId` opens the waypoint fast-travel panel. */
export function isWaypointObjectId(objectId: string): boolean {
  return findWaypointByObjectId(objectId) !== undefined;
}

/**
 * Town-side spawn id a player lands at when returning from `combatZoneId`
 * through its `combat_return_gate`. Falls back to the town's own default
 * spawn point since there is no per-combat-zone entry spawn yet.
 */
export function resolveCombatZoneReturnSpawnId(combatZoneId: ZoneId): string {
  return findRouteByCombatZoneId(combatZoneId)?.entrySpawnId ?? TOWN_DEFAULT_SPAWN_ID;
}

export type RouteTravelRejectedReason =
  | "route_unavailable"
  | "destination_unavailable"
  | "invalid_destination"
  | "travel_failed";

export interface RouteTravelSuccess {
  readonly ok: true;
  readonly objectId: string;
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly y: number;
  readonly messageKey: string;
  readonly areaKey: string;
  readonly handoffRoomKind?: "combat";
  readonly targetSpawnKey?: string;
}

export interface RouteTravelFailure {
  readonly ok: false;
  readonly reason: RouteTravelRejectedReason;
}

export interface WaypointTravelSuccess {
  readonly ok: true;
  readonly waypointId: string;
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly y: number;
}

export interface WaypointTravelFailure {
  readonly ok: false;
  readonly reason: WaypointRejectedReason;
}

function buildWaypointDestinations(activeIds: ReadonlySet<string>): WaypointDestinationEntry[] {
  // Task instruction: the fast-travel panel lists ONLY the player's own
  // already-unlocked waypoints, not every waypoint that exists.
  return WAYPOINT_DEFINITIONS.filter((waypoint) => activeIds.has(waypoint.waypointId)).map((waypoint) => ({
    waypointId: waypoint.waypointId,
    zoneId: waypoint.zoneId,
    labelKey: waypoint.labelKey,
    discovered: true,
  }));
}

export async function activateAndBuildWaypointPanel(
  characterId: CharacterId,
  objectId: string,
): Promise<WaypointOpenedServerMessage | null> {
  const waypoint = findWaypointByObjectId(objectId);
  if (waypoint === undefined) {
    return null;
  }

  const repository = new CharacterRepository();
  const existingActivations = await repository.listWaypointActivations(characterId.toString());
  const alreadyActivated = existingActivations.some(
    (entry: { waypointId: string }) => entry.waypointId === waypoint.waypointId,
  );

  if (!alreadyActivated) {
    await repository.activateWaypoint(characterId.toString(), waypoint.waypointId, waypoint.zoneId);
  }

  const activations = alreadyActivated ? existingActivations : await repository.listWaypointActivations(characterId.toString());
  const activeIds = new Set(activations.map((entry: { waypointId: string }) => entry.waypointId));

  return {
    type: "waypoint_opened",
    objectId: waypoint.objectId,
    waypointId: waypoint.waypointId,
    activated: !alreadyActivated,
    destinations: buildWaypointDestinations(activeIds),
  };
}

export async function resolveWaypointTravel(
  characterId: CharacterId,
  waypointId: string,
): Promise<WaypointTravelSuccess | WaypointTravelFailure> {
  const waypoint = findWaypointById(waypointId);
  if (waypoint === undefined) {
    return { ok: false, reason: "destination_unavailable" };
  }

  const repository = new CharacterRepository();
  const activations = await repository.listWaypointActivations(characterId.toString());
  const activated = activations.some((entry: { waypointId: string }) => entry.waypointId === waypointId);
  if (!activated) {
    return { ok: false, reason: "destination_not_activated" };
  }

  if (!isPositionInsideZoneBounds(waypoint.zoneId, waypoint.x, waypoint.y)) {
    return { ok: false, reason: "invalid_destination" };
  }

  return {
    ok: true,
    waypointId,
    zoneId: waypoint.zoneId,
    x: waypoint.x,
    y: waypoint.y,
  };
}

export function getWaypointRejectedMessage(reason: WaypointRejectedReason): string {
  switch (reason) {
    case "waypoint_unavailable":
      return t("town_service.waypoint.rejected.waypoint_unavailable" as never);
    case "destination_unavailable":
      return t("town_service.waypoint.rejected.destination_unavailable" as never);
    case "destination_not_activated":
      return t("town_service.waypoint.rejected.destination_not_activated" as never);
    case "invalid_destination":
      return t("town_service.waypoint.rejected.invalid_destination" as never);
    case "travel_failed":
    default:
      return t("town_service.waypoint.rejected.travel_failed" as never);
  }
}

export async function resolveRouteTravel(
  currentZoneId: ZoneId,
  objectId: string,
): Promise<RouteTravelSuccess | RouteTravelFailure> {
  if (currentZoneId !== TOWN_ZONE_ID) {
    return { ok: false, reason: "route_unavailable" };
  }

  const combatRoute = findRouteByGateObjectId(objectId);
  if (combatRoute !== undefined) {
    const townSideSpawn = contentRegistry.spawnPoints.get(combatRoute.entrySpawnId as never);
    if (townSideSpawn === undefined || townSideSpawn.zoneId !== TOWN_ZONE_ID) {
      return { ok: false, reason: "invalid_destination" };
    }
    if (!isPositionInsideZoneBounds(TOWN_ZONE_ID, townSideSpawn.x, townSideSpawn.y)) {
      return { ok: false, reason: "invalid_destination" };
    }

    if (!isPositionInsideZoneBounds(combatRoute.combatZoneId, COMBAT_ZONE_ENTRY_X, COMBAT_ZONE_ENTRY_Y)) {
      return { ok: false, reason: "invalid_destination" };
    }

    return {
      ok: true,
      objectId,
      zoneId: combatRoute.combatZoneId,
      x: COMBAT_ZONE_ENTRY_X,
      y: COMBAT_ZONE_ENTRY_Y,
      messageKey: combatRoute.messageKey,
      areaKey: combatRoute.areaKey,
      handoffRoomKind: "combat",
      targetSpawnKey: combatRoute.targetSpawnKey,
    };
  }

  return { ok: false, reason: "destination_unavailable" };
}

export function getRouteRejectedMessage(reason: RouteTravelRejectedReason): string {
  switch (reason) {
    case "route_unavailable":
      return t("town_service.route.rejected.route_unavailable" as never);
    case "destination_unavailable":
      return t("town_service.route.rejected.destination_unavailable" as never);
    case "invalid_destination":
      return t("town_service.route.rejected.invalid_destination" as never);
    case "travel_failed":
    default:
      return t("town_service.route.rejected.travel_failed" as never);
  }
}
