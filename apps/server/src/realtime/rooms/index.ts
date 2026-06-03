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
