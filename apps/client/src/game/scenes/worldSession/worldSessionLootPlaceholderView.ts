import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomWorldLootSnapshot } from "../../../net/townRoomWorldLoot";

const COMMON_LOOT_COLOR = "#ffe7a8";
const COMMON_LOOT_STROKE = "#221606";
const CURRENCY_LOOT_COLOR = "#f0c674";
const CURRENCY_LOOT_STROKE = "#1d1206";
const CURRENCY_LOOT_BODY_FILL = 0xd4a25a;
const CURRENCY_LOOT_BODY_STROKE = 0xffd58a;
const CURRENCY_LOOT_GLOW = 0xf0c674;
const CURRENCY_LOOT_PING = 0xffd58a;
const CURRENCY_LOOT_PING_STROKE = 0xffe7b3;

// Deterministic scatter offset per loot id so items at the same world
// position spread apart visually. Range ±12px on each axis.
const SCATTER_RANGE = 12;

function hashLootId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return h;
}

export function getScatterOffset(id: string): { readonly x: number; readonly y: number } {
  const h = hashLootId(id);
  return {
    x: (h % (SCATTER_RANGE * 2 + 1)) - SCATTER_RANGE,
    y: ((h >> 8) % (SCATTER_RANGE * 2 + 1)) - SCATTER_RANGE,
  };
}

function getItemRarityColor(rarity?: string): string {
  if (rarity === "rare") {
    return "#8fc7ff";
  }

  return COMMON_LOOT_COLOR;
}

function getItemRarityStrokeColor(rarity?: string): string {
  if (rarity === "rare") {
    return "#10233d";
  }

  return COMMON_LOOT_STROKE;
}

function getLootPlaceholderPalette(loot: TownRoomWorldLootSnapshot): {
  readonly glow: number;
  readonly ping: number;
  readonly pingStroke: number;
  readonly body: number;
  readonly bodyStroke: number;
} {
  if (loot.currencyCopper > 0) {
    return {
      glow: CURRENCY_LOOT_GLOW,
      ping: CURRENCY_LOOT_PING,
      pingStroke: CURRENCY_LOOT_PING_STROKE,
      body: CURRENCY_LOOT_BODY_FILL,
      bodyStroke: CURRENCY_LOOT_BODY_STROKE,
    };
  }

  if (loot.rarity === "rare") {
    return {
      glow: 0x66b7ff,
      ping: 0x9bd2ff,
      pingStroke: 0xd7efff,
      body: 0x4b86d8,
      bodyStroke: 0xe0f2ff,
    };
  }

  return {
    glow: 0xe7c66d,
    ping: 0xf7dc8b,
    pingStroke: 0xffefb3,
    body: 0xd4aa3d,
    bodyStroke: 0xffefb3,
  };
}

function isCurrencyLoot(loot: TownRoomWorldLootSnapshot): boolean {
  return loot.currencyCopper > 0;
}

function getCurrencyLabel(loot: TownRoomWorldLootSnapshot): string {
  const amount = Math.max(1, Math.floor(loot.currencyCopper));
  // Compact "3c" label for the in-world placeholder, alongside the
  // longer "Copper x3" form for readability. Pickup feedback still uses
  // the shared `formatMoneyCompact` path elsewhere.
  return `${amount}c`;
}

function getLootLabelText(loot: TownRoomWorldLootSnapshot): string {
  if (isCurrencyLoot(loot)) {
    return getCurrencyLabel(loot);
  }
  return t(loot.label);
}

function getLootLabelColor(loot: TownRoomWorldLootSnapshot): string {
  if (isCurrencyLoot(loot)) {
    return CURRENCY_LOOT_COLOR;
  }
  return getItemRarityColor(loot.rarity);
}

function getLootLabelStrokeColor(loot: TownRoomWorldLootSnapshot): string {
  if (isCurrencyLoot(loot)) {
    return CURRENCY_LOOT_STROKE;
  }
  return getItemRarityStrokeColor(loot.rarity);
}

export interface WorldSessionLootPlaceholderView {
  readonly refresh: (loot: TownRoomWorldLootSnapshot, isPendingTarget?: boolean) => void;
  readonly destroy: () => void;
}

export function createWorldSessionLootPlaceholderView(
  scene: Phaser.Scene,
  loot: TownRoomWorldLootSnapshot,
  parentContainer?: Phaser.GameObjects.Container,
  onClick?: (worldLootId: string) => void,
): WorldSessionLootPlaceholderView {
  const initialPalette = getLootPlaceholderPalette(loot);
  const scatter = getScatterOffset(loot.id);
  const container = scene.add.container(loot.x + scatter.x, loot.y + scatter.y);
  parentContainer?.add(container);
  const glow = scene.add.ellipse(0, 10, 26, 12, initialPalette.glow, 0.26);
  const ping = scene.add.ellipse(0, 9, 34, 14, initialPalette.ping, 0.12);
  ping.setStrokeStyle(2, initialPalette.pingStroke, 0.3);
  const body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse = isCurrencyLoot(loot)
    ? scene.add.ellipse(0, 0, 20, 20, initialPalette.body, 0.98)
    : scene.add.rectangle(0, 0, 20, 20, initialPalette.body, 0.98);
  body.setStrokeStyle(2, initialPalette.bodyStroke, 0.98);
  body.setInteractive({ useHandCursor: true });
  const targetRing = scene.add.ellipse(0, 0, 32, 32);
  targetRing.setStrokeStyle(2, 0xfbf2a2, 0);
  const labelBg = scene.add.rectangle(0, 17, 0, 16, 0x0a0a0a, 0.82);
  labelBg.setStrokeStyle(1, 0x4a4a4a, 0.6);
  const labelText = scene.add
    .text(0, 16, getLootLabelText(loot), {
      color: getLootLabelColor(loot),
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      stroke: getLootLabelStrokeColor(loot),
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  // Size label background to fit text
  const labelBounds = labelText.getBounds();
  labelBg.setSize(labelBounds.width + 8, 18);

  body.on(Phaser.Input.Events.POINTER_DOWN, () => {
    onClick?.(loot.id);
  });

  container.add([glow, ping, targetRing, body, labelBg, labelText]);

  const applyPendingTargetState = (isPendingTarget: boolean): void => {
    if (isPendingTarget) {
      targetRing.setStrokeStyle(2, 0xfbf2a2, 0.95);
      targetRing.setVisible(true);
      labelText.setScale(1.05);
      return;
    }

    targetRing.setStrokeStyle(2, 0xfbf2a2, 0);
    targetRing.setVisible(false);
    labelText.setScale(1);
  };
  applyPendingTargetState(false);

  return {
    refresh: (nextLoot: TownRoomWorldLootSnapshot, isPendingTarget = false) => {
      const nextScatter = getScatterOffset(nextLoot.id);
      container.setPosition(nextLoot.x + nextScatter.x, nextLoot.y + nextScatter.y);
      labelText.setText(getLootLabelText(nextLoot));
      labelText.setColor(getLootLabelColor(nextLoot));
      labelText.setStroke(getLootLabelStrokeColor(nextLoot), 3);
      const nextLabelBounds = labelText.getBounds();
      labelBg.setSize(nextLabelBounds.width + 8, 18);
      const palette = getLootPlaceholderPalette(nextLoot);
      glow.setFillStyle(palette.glow, 0.26);
      ping.setFillStyle(palette.ping, 0.12);
      ping.setStrokeStyle(2, palette.pingStroke, 0.3);
      body.setFillStyle(palette.body, 0.98);
      body.setStrokeStyle(2, palette.bodyStroke, 0.98);
      applyPendingTargetState(isPendingTarget);
    },
    destroy: () => {
      container.destroy(true);
    },
  };
}
