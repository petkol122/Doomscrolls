// Colyseus room registrations
export { TownRoom } from "./TownRoom";

// Public Colyseus room name constants
export { TOWN_ROOM_NAME } from "./townRoomName";

// Room-related shared type contracts
export type { TownRoomJoinOptions } from "./townRoomTypes";
export { TownRoomState } from "./TownRoomState";

// Spawn point resolution helper (Task 023.2).
export {
  NIGHTMARKET_DEFAULT_SPAWN_POINT_ID,
  resolveTownSpawnPoint,
} from "./resolveTownSpawnPoint";

// Movement intent validation helper (Task 026).
export {
  DEFAULT_MOVEMENT_INTENT_BOUNDS,
  validateMovementIntent,
} from "./movementIntentValidation";
export type {
  MovementIntentBounds,
  MovementIntentValidationInput,
  MovementIntentValidationResult,
} from "./movementIntentValidation";

// Server-authoritative town movement step helper (Task 042).
export {
  stepTownRoomMovement,
  TOWN_MOVEMENT_STOP_DISTANCE,
  TOWN_MOVEMENT_TICK_RATE_MS,
} from "./stepTownRoomMovement";

export {
  resolvePlayerMovementSpeed,
  TOWN_MOVEMENT_SPEED_FALLBACK_UNITS_PER_SECOND,
} from "./resolvePlayerMovementSpeed";
