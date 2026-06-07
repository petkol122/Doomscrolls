import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomWorldLootSnapshot } from "../../../net/townRoomWorldLoot";

const COMMON_LOOT_COLOR = "#ffe7a8";
const COMMON_LOOT_STROKE = "#221606";

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

function getLootPlaceholderPalette(rarity?: string): {
  readonly glow: number;
  readonly ping: number;
  readonly pingStroke: number;
  readonly body: number;
  readonly bodyStroke: number;
} {
  if (rarity === "rare") {
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
  const initialPalette = getLootPlaceholderPalette(loot.rarity);
  const container = scene.add.container(loot.x, loot.y);
  parentContainer?.add(container);
  const glow = scene.add.ellipse(0, 10, 26, 12, initialPalette.glow, 0.26);
  const ping = scene.add.ellipse(0, 9, 34, 14, initialPalette.ping, 0.12);
  ping.setStrokeStyle(2, initialPalette.pingStroke, 0.3);
  const body = scene.add.rectangle(0, 0, 16, 16, initialPalette.body, 0.98);
  body.setStrokeStyle(2, initialPalette.bodyStroke, 0.98);
  body.setInteractive({ useHandCursor: true });
  const targetRing = scene.add.ellipse(0, 0, 28, 28);
  targetRing.setStrokeStyle(2, 0xfbf2a2, 0);
  const labelText = scene.add
    .text(0, 16, t(loot.label), {
      color: getItemRarityColor(loot.rarity),
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      stroke: getItemRarityStrokeColor(loot.rarity),
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  body.on(Phaser.Input.Events.POINTER_DOWN, () => {
    onClick?.(loot.id);
  });

  container.add([glow, ping, targetRing, body, labelText]);

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
      container.setPosition(nextLoot.x, nextLoot.y);
      labelText.setText(t(nextLoot.label));
      labelText.setColor(getItemRarityColor(nextLoot.rarity));
      labelText.setStroke(getItemRarityStrokeColor(nextLoot.rarity), 3);
      const palette = getLootPlaceholderPalette(nextLoot.rarity);
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