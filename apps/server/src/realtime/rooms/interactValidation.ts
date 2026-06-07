import type { TownRoomState } from "./TownRoomState";
import { spawnWorldLootOnEnemyDefeat } from "./spawnWorldLootOnEnemyDefeat";
import { resolveZoneBounds } from "./resolveZoneBounds";
import { t } from "@doomscrolls/localization";

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
    // If position is out of bounds, still mark as opened but don't spawn loot
    interactable.opened = true;
    return { ok: true, message: "The container is empty." };
  }

  // Spawn loot near the container (using the same loot table as trashboar runts)
  const fakeEnemy = {
    id: `container_${objectId}`,
    enemyId: "trashboar_runt",
    x: lootX,
    y: lootY,
  } as { id: string; enemyId: string; x: number; y: number };

  const worldLoot = spawnWorldLootOnEnemyDefeat(state, fakeEnemy as any, Date.now());

  if (worldLoot !== null) {
    interactable.opened = true;
    return { ok: true, message: "The container opens, revealing its contents!" };
  }

  // If no loot spawned, still mark as opened to prevent re-tries
  interactable.opened = true;
  return { ok: true, message: "The container is empty." };
}

/**
 * Get a safe response message for an interactable object.
 * Currently hardcoded. Future: read from content definitions.
 */
export function getInteractableResponseMessage(objectId: string): string {
  const responses: Record<string, string> = {
    nightmarket_notice_board: "The notice board hums quietly.",
  };
  return responses[objectId] ?? "You interact with the object.";
}
