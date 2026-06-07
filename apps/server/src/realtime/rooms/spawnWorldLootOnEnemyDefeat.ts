import { contentRegistry } from "@doomscrolls/content";
import type { EnemyPresence, ItemDefinitionId, WorldLootId, ZoneId } from "@doomscrolls/shared";

import { TownRoomState } from "./TownRoomState";
import { WorldLoot } from "./WorldLoot";
import { rollCurrencyLoot } from "./rollCurrencyLoot";
import { rollLoot } from "./rollLoot";
import { createRng } from "./serverRng";
import { resolveZoneBounds } from "./resolveZoneBounds";

const MAX_ACTIVE_WORLD_LOOT = 20;
const BASE_FIXED_OFFSET_X = 10;
const BASE_FIXED_OFFSET_Y = 8;
const SCATTER_RANGE = 8;
const CURRENCY_LABEL_KEY = "money.currency_drop_label";

/**
 * Apply a small scatter offset derived from a seeded RNG so that drops
 * around a defeated enemy are spread out instead of stacking at one point.
 * The scatter is clamped to keep the result inside the zone bounds.
 */
function applyDropScatter(
  baseX: number,
  baseY: number,
  zoneId: ZoneId,
  seedExtra: string,
): { readonly x: number; readonly y: number } {
  const bounds = resolveZoneBounds(zoneId);
  // Derive a stable per-drop seed from enemy instance + seed extra
  const seed = hashStringToSeed(`${baseX},${baseY},${seedExtra}`);
  const rng = createRng(seed);
  const offsetX = rng.nextInt(-SCATTER_RANGE, SCATTER_RANGE + 1);
  const offsetY = rng.nextInt(-SCATTER_RANGE, SCATTER_RANGE + 1);
  const x = Math.round(Math.min(bounds.maxX, Math.max(bounds.minX, baseX + offsetX)));
  const y = Math.round(Math.min(bounds.maxY, Math.max(bounds.minY, baseY + offsetY)));
  return { x, y };
}

function hashStringToSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export interface SpawnedWorldLoot {
  readonly item: WorldLoot;
  readonly isCurrency: boolean;
}

/**
 * Spawn item and/or currency world loot around the defeated enemy.
 * Each drop gets its own server-RNG scatter offset so they do not stack.
 * Returns an array of spawned loot entries (empty if nothing dropped).
 */
export function spawnWorldLootOnEnemyDefeat(
  state: TownRoomState,
  enemy: EnemyPresence,
  now: number,
): WorldLoot[] {
  const spawned: WorldLoot[] = [];

  const itemId = rollLoot(enemy.enemyId);
  const currencyAmount = rollCurrencyLoot(enemy.enemyId, now);

  const baseX = enemy.x + BASE_FIXED_OFFSET_X;
  const baseY = enemy.y + BASE_FIXED_OFFSET_Y;

  if (itemId !== null) {
    const itemDefinition = contentRegistry.items.get(itemId);
    if (itemDefinition !== undefined) {
      const pos = applyDropScatter(baseX, baseY, state.zoneId, `item:${now}`);
      const loot = new WorldLoot(
        buildWorldLootId(enemy.id, "item", now),
        itemId,
        itemDefinition.nameKey,
        itemDefinition.rarity,
        pos.x,
        pos.y,
        0,
      );
      evictOldestWorldLootIfNeeded(state);
      state.worldLoot.set(loot.id, loot);
      spawned.push(loot);
    }
  }

  if (currencyAmount > 0) {
    const pos = applyDropScatter(baseX, baseY, state.zoneId, `coin:${now}`);
    const loot = new WorldLoot(
      buildWorldLootId(enemy.id, "coin", now),
      "" as ItemDefinitionId,
      CURRENCY_LABEL_KEY,
      "common",
      pos.x,
      pos.y,
      currencyAmount,
    );
    evictOldestWorldLootIfNeeded(state);
    state.worldLoot.set(loot.id, loot);
    spawned.push(loot);
  }

  return spawned;
}

function buildWorldLootId(
  enemyInstanceId: string,
  kind: "item" | "coin",
  now: number,
): WorldLootId {
  return `world_loot:${enemyInstanceId}:${kind}:${now}` as WorldLootId;
}

function evictOldestWorldLootIfNeeded(state: TownRoomState): void {
  if (state.worldLoot.size < MAX_ACTIVE_WORLD_LOOT) {
    return;
  }

  const oldestLootId = state.worldLoot.keys().next().value;
  if (typeof oldestLootId !== "string") {
    return;
  }

  state.worldLoot.delete(oldestLootId);
}
