import { Interactable } from "./Interactable";
import type { TownRoomState } from "./TownRoomState";
import type { ZoneId } from "@doomscrolls/shared";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Initialize static interactable objects for the room.
 * Currently hardcoded for nightmarket zone with one notice board.
 * Future: read from content definitions.
 */
export function initializeTownInteractables(
  state: TownRoomState,
  zoneId: ZoneId,
): void {
  if (zoneId === "nightmarket") {
    const noticeBoard = new Interactable(
      "nightmarket_notice_board",
      "notice_board",
      "Notice Board",
      120, // x: near spawn point
      140, // y: near spawn point
    );
    state.interactables.set(noticeBoard.id, noticeBoard);
  }
  // Future: add more zones and objects
}
