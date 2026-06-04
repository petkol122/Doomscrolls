import type { SpawnPointId, ZoneId } from "../ids";

export interface SpawnPointDefinition {
  readonly id: SpawnPointId;
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly y: number;
  readonly labelKey?: string;
}