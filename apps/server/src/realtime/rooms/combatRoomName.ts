/**
 * Public, stable Colyseus room name for the (currently minimal) CombatRoom.
 *
 * Task 263 scope: register a thin `CombatRoom` under a clear, stable name
 * so future dedicated tasks (real client connection, gameplay wiring, full
 * combat/loot reuse from `TownRoom`) can join it without changing the
 * public name.
 */
export const COMBAT_ROOM_NAME = "combat";
