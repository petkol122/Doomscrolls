import { Interactable } from "./Interactable";
import type { TownRoomState } from "./TownRoomState";
import type { ZoneId } from "@doomscrolls/shared";
import { contentRegistry } from "@doomscrolls/content";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Initialize static interactable objects for the room.
 * Currently hardcoded for nightmarket zone with one notice board.
 * Task 180 — Added loot container from content definitions.
 * Task 197 — Added neutral vendor placeholder.
 * Task 205 — Added stash keeper town-service placeholder.
 * Future: read all interactables from content definitions.
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

    // Task 180 — Shared loot container from worldProps content
    const lootContainerProp = contentRegistry.worldProps.get("nightmarket_loot_container_01");
    if (lootContainerProp !== undefined) {
      const lootContainer = new Interactable(
        lootContainerProp.id,
        "loot_container",
        lootContainerProp.label,
        lootContainerProp.x,
        lootContainerProp.y,
        false, // initially unopened
      );
      state.interactables.set(lootContainer.id, lootContainer);
    }

    // Task 197 — Neutral vendor placeholder
    const vendorProp = contentRegistry.worldProps.get("nightmarket_vendor_01");
    if (vendorProp !== undefined) {
      const vendor = new Interactable(
        vendorProp.id,
        "vendor",
        vendorProp.label,
        vendorProp.x,
        vendorProp.y,
      );
      state.interactables.set(vendor.id, vendor);
    }

    // Task 205 — Stash keeper town-service placeholder
    const stashProp = contentRegistry.worldProps.get("nightmarket_stash_keeper_01");
    if (stashProp !== undefined) {
      const stash = new Interactable(
        stashProp.id,
        "town_service",
        stashProp.label,
        stashProp.x,
        stashProp.y,
      );
      state.interactables.set(stash.id, stash);
    }

    // Task 208 — Trainer town-service placeholder
    const trainerProp = contentRegistry.worldProps.get("nightmarket_trainer_01");
    if (trainerProp !== undefined) {
      const trainer = new Interactable(
        trainerProp.id,
        "town_service",
        trainerProp.label,
        trainerProp.x,
        trainerProp.y,
      );
      state.interactables.set(trainer.id, trainer);
    }
  }
  // Future: add more zones and objects
}
