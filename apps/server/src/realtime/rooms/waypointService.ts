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

const NIGHTMARKET_WAYPOINT_OBJECT_ID = "nightmarket_waypoint_01";
const NIGHTMARKET_WAYPOINT_ID = "nightmarket_waypoint_01";
const BLACKWIRE_COMBAT_EDGE_WAYPOINT_OBJECT_ID = "nightmarket_waypoint_blackwire_combat_edge";
const BLACKWIRE_COMBAT_EDGE_WAYPOINT_ID = "nightmarket_waypoint_blackwire_combat_edge";
const BLACKWIRE_GATE_OBJECT_ID = "nightmarket_blackwire_gate_01";
const BLACKWIRE_RETURN_OBJECT_ID = "nightmarket_blackwire_return_01";

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

function resolveWaypointFromObjectId(objectId: string): {
  readonly objectId: string;
  readonly waypointId: string;
} | null {
  if (objectId === NIGHTMARKET_WAYPOINT_OBJECT_ID) {
    return { objectId, waypointId: NIGHTMARKET_WAYPOINT_ID };
  }
  if (objectId === BLACKWIRE_COMBAT_EDGE_WAYPOINT_OBJECT_ID) {
    return { objectId, waypointId: BLACKWIRE_COMBAT_EDGE_WAYPOINT_ID };
  }
  return null;
}

function buildWaypointDestinations(activeIds: ReadonlySet<string>): WaypointDestinationEntry[] {
  const allDestinations: readonly WaypointDestinationEntry[] = [
    {
      waypointId: NIGHTMARKET_WAYPOINT_ID,
      zoneId: "nightmarket" as ZoneId,
      labelKey: "waypoint.destination.nightmarket_arrival",
    },
    {
      waypointId: BLACKWIRE_COMBAT_EDGE_WAYPOINT_ID,
      zoneId: "nightmarket" as ZoneId,
      labelKey: "waypoint.destination.nightmarket_blackwire_combat_edge",
    },
  ];

  return allDestinations.filter((entry) => activeIds.has(entry.waypointId));
}

export async function activateAndBuildWaypointPanel(
  characterId: CharacterId,
  objectId: string,
): Promise<WaypointOpenedServerMessage | null> {
  const resolvedWaypoint = resolveWaypointFromObjectId(objectId);
  if (resolvedWaypoint === null) {
    return null;
  }

  const repository = new CharacterRepository();
  const existingActivations = await repository.listWaypointActivations(characterId.toString());
  const alreadyActivated = existingActivations.some(
    (entry: { waypointId: string }) => entry.waypointId === resolvedWaypoint.waypointId,
  );

  if (!alreadyActivated) {
    await repository.activateWaypoint(characterId.toString(), resolvedWaypoint.waypointId, "nightmarket");
  }

  const activations = await repository.listWaypointActivations(characterId.toString());
  const activeIds = new Set(activations.map((entry: { waypointId: string }) => entry.waypointId));

  return {
    type: "waypoint_opened",
    objectId: resolvedWaypoint.objectId,
    waypointId: resolvedWaypoint.waypointId,
    activated: !alreadyActivated,
    destinations: buildWaypointDestinations(activeIds),
  };
}

export async function resolveWaypointTravel(
  characterId: CharacterId,
  currentZoneId: ZoneId,
  waypointId: string,
): Promise<WaypointTravelSuccess | WaypointTravelFailure> {
  if (currentZoneId !== ("nightmarket" as ZoneId)) {
    return { ok: false, reason: "waypoint_unavailable" };
  }
  if (waypointId !== NIGHTMARKET_WAYPOINT_ID && waypointId !== BLACKWIRE_COMBAT_EDGE_WAYPOINT_ID) {
    return { ok: false, reason: "destination_unavailable" };
  }

  const spawnId = waypointId === BLACKWIRE_COMBAT_EDGE_WAYPOINT_ID
    ? "nightmarket_blackwire_combat_entry"
    : "nightmarket_spawn";

  const repository = new CharacterRepository();
  const activations = await repository.listWaypointActivations(characterId.toString());
  const activated = activations.some((entry: { waypointId: string }) => entry.waypointId === waypointId);
  if (!activated) {
    return { ok: false, reason: "destination_not_activated" };
  }

  const spawn = contentRegistry.spawnPoints.get(spawnId as never);
  if (spawn === undefined) {
    return { ok: false, reason: "invalid_destination" };
  }
  if (spawn.zoneId !== "nightmarket") {
    return { ok: false, reason: "invalid_destination" };
  }
  if (!isPositionInsideZoneBounds("nightmarket" as ZoneId, spawn.x, spawn.y)) {
    return { ok: false, reason: "invalid_destination" };
  }

  return {
    ok: true,
    waypointId,
    zoneId: "nightmarket" as ZoneId,
    x: spawn.x,
    y: spawn.y,
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
  if (currentZoneId !== ("nightmarket" as ZoneId)) {
    return { ok: false, reason: "route_unavailable" };
  }

  const destinationSpawnId = (() => {
    if (objectId === BLACKWIRE_GATE_OBJECT_ID) {
      return "nightmarket_blackwire_combat_entry";
    }
    if (objectId === BLACKWIRE_RETURN_OBJECT_ID) {
      return "nightmarket_services_return";
    }
    return null;
  })();

  if (destinationSpawnId === null) {
    return { ok: false, reason: "destination_unavailable" };
  }

  const spawn = contentRegistry.spawnPoints.get(destinationSpawnId as never);
  if (spawn === undefined || spawn.zoneId !== "nightmarket") {
    return { ok: false, reason: "invalid_destination" };
  }
  if (!isPositionInsideZoneBounds("nightmarket" as ZoneId, spawn.x, spawn.y)) {
    return { ok: false, reason: "invalid_destination" };
  }

  if (objectId === BLACKWIRE_GATE_OBJECT_ID) {
    return {
      ok: true,
      objectId,
      zoneId: "blackwire_sewers" as ZoneId,
      x: spawn.x,
      y: spawn.y,
      messageKey: "town_service.route.travel_success.to_combat",
      areaKey: "world_prop.area.blackwire_sewer_edge.label",
      handoffRoomKind: "combat",
      targetSpawnKey: "blackwire_entry",
    };
  }

  return {
    ok: true,
    objectId,
    zoneId: "nightmarket" as ZoneId,
    x: spawn.x,
    y: spawn.y,
    messageKey: "town_service.route.travel_success.to_hub",
    areaKey: "world_prop.area.nightmarket_services.label",
  };
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