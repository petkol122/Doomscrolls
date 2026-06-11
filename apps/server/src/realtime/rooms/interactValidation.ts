import type { TownRoomState } from "./TownRoomState";
import { contentRegistry } from "@doomscrolls/content";
import type { ItemDefinitionId, WorldLootId } from "@doomscrolls/shared";
import { resolveZoneBounds } from "./resolveZoneBounds";
import { rollCrateCurrencyChance } from "./rollCrateCurrencyChance";
import { rollLoot } from "./rollLoot";
import { WorldLoot } from "./WorldLoot";
import { t } from "@doomscrolls/localization";

const CRATE_CURRENCY_LABEL_KEY = "money.currency_drop_label";

/**
 * Task 057 — Interactable Object Foundation Batch
 *
 * Validate an interact request.
 * Simple distance check: player must be within ~50 units of the object.
 * Task 180 — Added loot container handling.
 */
export interface InteractValidationResult {
  readonly ok: boolean;
  readonly reason?: "object_not_found" | "out_of_range" | "invalid_shape" | "player_downed" | "already_opened";
  readonly message?: string;
  readonly lootSpawned?: boolean;
}

const INTERACT_DISTANCE = 50;

export function validateInteractIntent(
  state: TownRoomState,
  playerX: number,
  playerY: number,
  objectId: string,
  playerLifeState?: string,
): InteractValidationResult {
  if (playerLifeState !== undefined && playerLifeState !== "alive") {
    return { ok: false, reason: "player_downed" };
  }

  if (typeof objectId !== "string" || objectId.length === 0) {
    return { ok: false, reason: "invalid_shape" };
  }

  const interactable = state.interactables.get(objectId);
  if (!interactable) {
    return { ok: false, reason: "object_not_found" };
  }

  const dx = interactable.x - playerX;
  const dy = interactable.y - playerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > INTERACT_DISTANCE) {
    return { ok: false, reason: "out_of_range" };
  }

  // Task 180 — Check if loot container is already opened
  if (interactable.type === "loot_container" && interactable.opened) {
    return { ok: false, reason: "already_opened" };
  }

  return { ok: true };
}

/**
 * Handle loot container interaction - spawns loot near the container.
 * Task 180 — Shared loot container foundation.
 * Task 181 — Validate loot position against zone bounds.
 * Task 188 — Adds a small copper chance via the existing currency
 * world-loot pickup path. Item loot continues to work; the container
 * still opens once per room instance (no respawn, no client roll).
 */
export function handleLootContainerInteraction(
  state: TownRoomState,
  objectId: string,
): { ok: boolean; message: string } {
  const interactable = state.interactables.get(objectId);
  if (!interactable || interactable.type !== "loot_container") {
    return { ok: false, message: "Invalid container." };
  }

  if (interactable.opened) {
    return { ok: false, message: t("world_prop.loot_container.empty") };
  }

  // Mark as opened immediately so the container is one-shot per room
  // instance regardless of which downstream rolls happen.
  interactable.opened = true;

  // Calculate loot position near the container
  const lootX = interactable.x + 14;
  const lootY = interactable.y + 10;

  // Validate loot position is within zone bounds
  const zoneBounds = resolveZoneBounds(state.zoneId);
  if (
    lootX < zoneBounds.minX ||
    lootX > zoneBounds.maxX ||
    lootY < zoneBounds.minY ||
    lootY > zoneBounds.maxY
  ) {
    return { ok: true, message: "The container is empty." };
  }

  const now = Date.now();
  let spawned = 0;

  // 1. Item loot — uses the shared sewer starter loot table so the
  //    crate's item drops match the rest of the world. Server-only
  //    roll, no client input.
  const itemId = rollLoot("trashboar_runt");
  if (itemId !== null) {
    const itemDefinition = contentRegistry.items.get(itemId);
    if (itemDefinition !== undefined) {
      const itemLoot = new WorldLoot(
        buildCrateWorldLootId(objectId, "item", now),
        itemId,
        itemDefinition.nameKey,
        itemDefinition.rarity,
        lootX,
        lootY,
        0,
      );
      state.worldLoot.set(itemLoot.id, itemLoot);
      spawned += 1;
    }
  }

  // 2. Currency chance — independent small copper drop that flows
  //    through the existing currency world-loot pickup path
  //    (persistPickedUpCurrencyToCharacter + dispatchPickedUpWorldLoot).
  const currencyAmount = rollCrateCurrencyChance(objectId, now);
  if (currencyAmount > 0) {
    const currencyLoot = new WorldLoot(
      buildCrateWorldLootId(objectId, "coin", now),
      "" as ItemDefinitionId,
      CRATE_CURRENCY_LABEL_KEY,
      "common",
      lootX + 6,
      lootY,
      currencyAmount,
    );
    state.worldLoot.set(currencyLoot.id, currencyLoot);
    spawned += 1;
  }

  if (spawned > 0) {
    return { ok: true, message: "The container opens, revealing its contents!" };
  }
  return { ok: true, message: "The container is empty." };
}

function buildCrateWorldLootId(
  containerId: string,
  kind: "item" | "coin",
  now: number,
): WorldLootId {
  return `world_loot:crate:${containerId}:${kind}:${now}` as WorldLootId;
}

/**
 * Get a safe response message for an interactable object.
 *
 * Task 205 — Town-service placeholders (Stash Keeper) read the
 * `unavailableMessageKey` from the content registry so server and
 * client stay aligned on the "not available yet" copy.
 */
export function getInteractableResponseMessage(objectId: string): string {
  if (objectId === "nightmarket_blackwire_gate_01") {
    return t("town_service.route.blackwire_gate.prompt");
  }
  if (objectId === "nightmarket_blackwire_return_01") {
    return t("town_service.route.blackwire_return.prompt");
  }
  if (objectId === "nightmarket_stash_keeper_01") {
    const service = contentRegistry.townServices.get("nightmarket_stash_keeper");
    if (service !== undefined) {
      return t(service.unavailableMessageKey);
    }
  }
  if (objectId === "nightmarket_trainer_01") {
    const service = contentRegistry.townServices.get("nightmarket_trainer");
    if (service !== undefined) {
      return t(service.unavailableMessageKey);
    }
  }
  if (objectId === "nightmarket_waypoint_01") {
    const service = contentRegistry.townServices.get("nightmarket_waypoint");
    if (service !== undefined) {
      return t(service.unavailableMessageKey);
    }
  }
  // Vendor interaction — use town service content definition for greeting
  if (objectId === "nightmarket_vendor_01") {
    const vendorService = contentRegistry.townServices.get("nightmarket_suspicious_vendor");
    if (vendorService !== undefined) {
      return `${t(vendorService.labelKey)}: \"What're you buyin'?\"`;
    }
    return '"What\'re you buyin\'?"';
  }
  const responses: Record<string, string> = {
    nightmarket_notice_board_01: "The notice board hums quietly.",
  };
  return responses[objectId] ?? "You interact with the object.";
}
