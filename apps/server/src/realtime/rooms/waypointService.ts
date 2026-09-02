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

/**
 * Interior landing position for a fresh combat-zone entry, near the
 * zone's own `combat_return_gate` (the same safe box `CombatRoom`
 * already uses to center a player on respawn -- see
 * `initializeCombatEnemies.ts`). Both combat zones share identical
 * bounds today (0-800 x 0-600), so one shared entry point is
 * consistent with that existing "same box works for any combat zone"
 * precedent, not a new inconsistency.
 */
const COMBAT_ZONE_ENTRY_X = Math.round((COMBAT_SPAWN_BOX.minX + COMBAT_SPAWN_BOX.maxX) / 2);
const COMBAT_ZONE_ENTRY_Y = Math.round((COMBAT_SPAWN_BOX.minY + COMBAT_SPAWN_BOX.maxY) / 2);

const NIGHTMARKET_WAYPOINT_OBJECT_ID = "nightmarket_waypoint_01";
const NIGHTMARKET_WAYPOINT_ID = "nightmarket_waypoint_01";
const BLACKWIRE_RETURN_OBJECT_ID = "nightmarket_blackwire_return_01";

/**
 * Core 0.6 Wave 2 — content-driven combat-zone routing table.
 *
 * Before this change, every combat-zone destination (Blackwire Sewers)
 * was a set of named string constants plus an inline `zoneId` literal
 * scattered across this file, TownRoom.ts and CombatRoom.ts. That pattern
 * doubles for every new combat zone. This table is the single place a
 * new combat zone's routing gets registered; the gate/waypoint/return
 * resolution functions below all read from it instead of branching on
 * hardcoded object ids.
 */
interface CombatZoneRoute {
  readonly gateObjectId: string;
  readonly combatZoneId: ZoneId;
  /**
   * Nightmarket-side spawn point used both directions: stored as the
   * player's room-intent position before the combat handoff, and used
   * as the landing position when the player leaves via the zone's
   * `combat_return_gate`.
   */
  readonly entrySpawnId: string;
  /** Cosmetic label carried in handoff messages only; never used to resolve a position. */
  readonly targetSpawnKey: string;
  readonly messageKey: string;
  readonly areaKey: string;
  readonly waypointObjectId?: string;
  readonly waypointId?: string;
  readonly waypointLabelKey?: string;
}

const COMBAT_ZONE_ROUTES: readonly CombatZoneRoute[] = [
  {
    gateObjectId: "nightmarket_blackwire_gate_01",
    combatZoneId: "blackwire_sewers" as ZoneId,
    entrySpawnId: "nightmarket_blackwire_combat_entry",
    targetSpawnKey: "blackwire_entry",
    messageKey: "town_service.route.travel_success.to_combat",
    areaKey: "world_prop.area.blackwire_sewer_edge.label",
    waypointObjectId: "nightmarket_waypoint_blackwire_combat_edge",
    waypointId: "nightmarket_waypoint_blackwire_combat_edge",
    waypointLabelKey: "waypoint.destination.nightmarket_blackwire_combat_edge",
  },
  {
    // Core 0.6 — Static Yard, the second combat zone.
    gateObjectId: "nightmarket_static_yard_gate_01",
    combatZoneId: "static_yard" as ZoneId,
    entrySpawnId: "nightmarket_static_yard_combat_entry",
    targetSpawnKey: "static_yard_entry",
    messageKey: "town_service.route.travel_success.to_combat",
    areaKey: "world_prop.area.static_yard_edge.label",
    waypointObjectId: "nightmarket_waypoint_static_yard_combat_edge",
    waypointId: "nightmarket_waypoint_static_yard_combat_edge",
    waypointLabelKey: "waypoint.destination.nightmarket_static_yard_combat_edge",
  },
  {
    // Core 0.16 — Cinderworks, the third combat zone.
    gateObjectId: "nightmarket_cinderworks_gate_01",
    combatZoneId: "cinderworks" as ZoneId,
    entrySpawnId: "nightmarket_cinderworks_combat_entry",
    targetSpawnKey: "cinderworks_entry",
    messageKey: "town_service.route.travel_success.to_combat",
    areaKey: "world_prop.area.cinderworks_edge.label",
    waypointObjectId: "nightmarket_waypoint_cinderworks_combat_edge",
    waypointId: "nightmarket_waypoint_cinderworks_combat_edge",
    waypointLabelKey: "waypoint.destination.nightmarket_cinderworks_combat_edge",
  },
  {
    // Core 0.18 — Saltmere Docks, the fourth combat zone.
    gateObjectId: "nightmarket_saltmere_docks_gate_01",
    combatZoneId: "saltmere_docks" as ZoneId,
    entrySpawnId: "nightmarket_saltmere_docks_combat_entry",
    targetSpawnKey: "saltmere_docks_entry",
    messageKey: "town_service.route.travel_success.to_combat",
    areaKey: "world_prop.area.saltmere_docks_edge.label",
    waypointObjectId: "nightmarket_waypoint_saltmere_docks_combat_edge",
    waypointId: "nightmarket_waypoint_saltmere_docks_combat_edge",
    waypointLabelKey: "waypoint.destination.nightmarket_saltmere_docks_combat_edge",
  },
];

function findRouteByGateObjectId(objectId: string): CombatZoneRoute | undefined {
  return COMBAT_ZONE_ROUTES.find((route) => route.gateObjectId === objectId);
}

function findRouteByWaypointObjectId(objectId: string): CombatZoneRoute | undefined {
  return COMBAT_ZONE_ROUTES.find((route) => route.waypointObjectId === objectId);
}

function findRouteByWaypointId(waypointId: string): CombatZoneRoute | undefined {
  return COMBAT_ZONE_ROUTES.find((route) => route.waypointId === waypointId);
}

function findRouteByCombatZoneId(zoneId: ZoneId): CombatZoneRoute | undefined {
  return COMBAT_ZONE_ROUTES.find((route) => route.combatZoneId === zoneId);
}

/** True when `objectId` is a town-side gate that hands a player off into a combat zone. */
export function isCombatGateObjectId(objectId: string): boolean {
  return findRouteByGateObjectId(objectId) !== undefined;
}

/** True when `objectId` opens the waypoint panel (the base panel or a combat-zone fast-travel entry). */
export function isWaypointObjectId(objectId: string): boolean {
  return objectId === NIGHTMARKET_WAYPOINT_OBJECT_ID || findRouteByWaypointObjectId(objectId) !== undefined;
}

/**
 * Nightmarket-side spawn id a player lands at when returning from
 * `combatZoneId` through its `combat_return_gate`. Falls back to
 * Blackwire's entry spawn for an unregistered zone, matching this
 * file's existing "unknown combat zone falls back to Blackwire"
 * convention used elsewhere in the realtime layer.
 */
export function resolveCombatZoneReturnSpawnId(combatZoneId: ZoneId): string {
  return findRouteByCombatZoneId(combatZoneId)?.entrySpawnId ?? "nightmarket_blackwire_combat_entry";
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

function resolveWaypointFromObjectId(objectId: string): {
  readonly objectId: string;
  readonly waypointId: string;
} | null {
  if (objectId === NIGHTMARKET_WAYPOINT_OBJECT_ID) {
    return { objectId, waypointId: NIGHTMARKET_WAYPOINT_ID };
  }
  const route = findRouteByWaypointObjectId(objectId);
  if (route !== undefined && route.waypointId !== undefined) {
    return { objectId, waypointId: route.waypointId };
  }
  return null;
}

// Task 355 — the panel now presents the full waypoint catalog (not just
// activated entries) so players can see undiscovered destinations and
// overall discovery progress instead of only ever seeing what they already
// unlocked.
function buildWaypointDestinations(activeIds: ReadonlySet<string>): WaypointDestinationEntry[] {
  const allDestinations: readonly Omit<WaypointDestinationEntry, "discovered">[] = [
    {
      waypointId: NIGHTMARKET_WAYPOINT_ID,
      zoneId: "nightmarket" as ZoneId,
      labelKey: "waypoint.destination.nightmarket_arrival",
    },
    ...COMBAT_ZONE_ROUTES.filter(
      (route): route is CombatZoneRoute & { readonly waypointId: string; readonly waypointLabelKey: string } =>
        route.waypointId !== undefined && route.waypointLabelKey !== undefined,
    ).map((route) => ({
      waypointId: route.waypointId,
      zoneId: "nightmarket" as ZoneId,
      labelKey: route.waypointLabelKey,
    })),
  ];

  return allDestinations.map((entry) => ({
    ...entry,
    discovered: activeIds.has(entry.waypointId),
  }));
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

  const route = findRouteByWaypointId(waypointId);
  if (waypointId !== NIGHTMARKET_WAYPOINT_ID && route === undefined) {
    return { ok: false, reason: "destination_unavailable" };
  }

  const spawnId = route !== undefined ? route.entrySpawnId : "nightmarket_spawn";

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

  const combatRoute = findRouteByGateObjectId(objectId);
  if (combatRoute !== undefined) {
    // Content-integrity check only: confirms the route's nightmarket-side
    // spawn record is well-formed. Its x/y are nightmarket coordinates and
    // must never be reused as the combat-zone landing position below --
    // that was the bug (a player would land at nightmarket-scale
    // coordinates like (2860, 2120) inside a zone whose bounds only run
    // 0-800 x 0-600, i.e. numerically outside the combat zone entirely).
    const nightmarketSideSpawn = contentRegistry.spawnPoints.get(combatRoute.entrySpawnId as never);
    if (nightmarketSideSpawn === undefined || nightmarketSideSpawn.zoneId !== "nightmarket") {
      return { ok: false, reason: "invalid_destination" };
    }
    if (!isPositionInsideZoneBounds("nightmarket" as ZoneId, nightmarketSideSpawn.x, nightmarketSideSpawn.y)) {
      return { ok: false, reason: "invalid_destination" };
    }

    // The actual landing position: an interior point inside the target
    // combat zone's own bounds, near its `combat_return_gate`.
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

  if (objectId === BLACKWIRE_RETURN_OBJECT_ID) {
    const spawn = contentRegistry.spawnPoints.get("nightmarket_services_return" as never);
    if (spawn === undefined || spawn.zoneId !== "nightmarket") {
      return { ok: false, reason: "invalid_destination" };
    }
    if (!isPositionInsideZoneBounds("nightmarket" as ZoneId, spawn.x, spawn.y)) {
      return { ok: false, reason: "invalid_destination" };
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
