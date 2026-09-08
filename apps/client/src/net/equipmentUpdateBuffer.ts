import type { Room } from "@colyseus/sdk";
import type { EquipmentLoadout, EquipmentUpdatedServerMessage, RoomState } from "@doomscrolls/shared";

/**
 * The server sends `equipment_updated` during `onJoin` so a client that
 * enters with gear already equipped from a previous session sees it
 * immediately, not only after its next equip/unequip. But that message can
 * arrive over the socket before `WorldSessionScene` exists to register
 * `registerEquipmentListener` (there's a real gap: the Phaser scene
 * transition between the join resolving and the new scene's `create()`
 * running) -- Colyseus drops a message with no handler registered for its
 * type instead of queuing it, so without this buffer the join-time message
 * is silently lost.
 *
 * `bufferEquipmentUpdatesFor` is called immediately after a room join
 * resolves (the earliest point client code can run), well before any scene
 * transition. `consumeBufferedEquipmentLoadout` is called once
 * `registerEquipmentListener` mounts, to pick up whatever arrived in the
 * meantime.
 */
const bufferedLoadoutByRoom = new WeakMap<Room<RoomState>, EquipmentLoadout>();

export function bufferEquipmentUpdatesFor(room: Room<RoomState>): void {
  room.onMessage("equipment_updated", (message: unknown) => {
    const msg = message as EquipmentUpdatedServerMessage;
    if (msg.type === "equipment_updated" && msg.equipment !== undefined) {
      bufferedLoadoutByRoom.set(room, msg.equipment);
    }
  });
}

export function consumeBufferedEquipmentLoadout(room: Room<RoomState>): EquipmentLoadout | null {
  const loadout = bufferedLoadoutByRoom.get(room) ?? null;
  bufferedLoadoutByRoom.delete(room);
  return loadout;
}
