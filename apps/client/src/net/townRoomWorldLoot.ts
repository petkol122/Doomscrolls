import type { LocalizationKey } from "@doomscrolls/localization";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

export interface TownRoomWorldLootSnapshot {
  readonly id: string;
  readonly itemId: string;
  readonly label: LocalizationKey;
  readonly rarity?: string;
  readonly currencyCopper: number;
  readonly x: number;
  readonly y: number;
}

export function getTownRoomWorldLoot(
  roomState: DoomscrollsRoomState,
): readonly TownRoomWorldLootSnapshot[] {
  const state = roomState as unknown as Record<string, unknown>;
  const rawWorldLoot = state.worldLoot;

  if (rawWorldLoot === undefined || rawWorldLoot === null) {
    return [];
  }

  const worldLootMap = rawWorldLoot as {
    forEach: (fn: (value: Record<string, unknown>, key: string) => void) => void;
  };

  const results: TownRoomWorldLootSnapshot[] = [];
  worldLootMap.forEach((entry) => {
    const id = entry.id;
    const itemId = entry.itemId;
    const label = entry.label;
    const rarity = entry.rarity;
    const rawCurrencyCopper = entry.currencyCopper;
    const x = entry.x;
    const y = entry.y;

    if (
      typeof id !== "string" ||
      typeof itemId !== "string" ||
      typeof label !== "string" ||
      (rarity !== undefined && typeof rarity !== "string") ||
      typeof x !== "number" ||
      typeof y !== "number"
    ) {
      return;
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const currencyCopper =
      typeof rawCurrencyCopper === "number" &&
      Number.isFinite(rawCurrencyCopper) &&
      rawCurrencyCopper > 0
        ? Math.floor(rawCurrencyCopper)
        : 0;

    results.push({
      id,
      itemId,
      label: label as LocalizationKey,
      ...(rarity === undefined ? {} : { rarity }),
      currencyCopper,
      x,
      y,
    });
  });

  return results;
}
