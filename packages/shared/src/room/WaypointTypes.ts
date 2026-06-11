import type { CharacterId, ZoneId } from "../ids";

export type WaypointRejectedReason =
  | "waypoint_unavailable"
  | "destination_unavailable"
  | "destination_not_activated"
  | "invalid_destination"
  | "travel_failed";

export interface WaypointDestinationEntry {
  readonly waypointId: string;
  readonly zoneId: ZoneId;
  readonly labelKey: string;
  readonly activated: boolean;
  readonly available: boolean;
}

export interface WaypointActivationRecord {
  readonly characterId: CharacterId;
  readonly waypointId: string;
  readonly zoneId: ZoneId;
  readonly activatedAt: string;
}