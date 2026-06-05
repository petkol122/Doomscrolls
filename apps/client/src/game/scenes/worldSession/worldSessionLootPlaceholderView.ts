import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomWorldLootSnapshot } from "../../../net/townRoomWorldLoot";

export interface WorldSessionLootPlaceholderView {
  readonly refresh: (loot: TownRoomWorldLootSnapshot) => void;
  readonly destroy: () => void;
}

export function createWorldSessionLootPlaceholderView(
  scene: Phaser.Scene,
  loot: TownRoomWorldLootSnapshot,
  parentContainer?: Phaser.GameObjects.Container,
  onClick?: (worldLootId: string) => void,
): WorldSessionLootPlaceholderView {
  const container = scene.add.container(loot.x, loot.y);
  parentContainer?.add(container);
  const glow = scene.add.ellipse(0, 10, 26, 12, 0xe7c66d, 0.26);
  const ping = scene.add.ellipse(0, 9, 34, 14, 0xf7dc8b, 0.12);
  ping.setStrokeStyle(2, 0xffefb3, 0.3);
  const body = scene.add.rectangle(0, 0, 16, 16, 0xd4aa3d, 0.98);
  body.setStrokeStyle(2, 0xffefb3, 0.98);
  body.setInteractive({ useHandCursor: true });
  const labelText = scene.add
    .text(0, 16, t(loot.label), {
      color: "#ffe7a8",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      stroke: "#221606",
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  body.on(Phaser.Input.Events.POINTER_DOWN, () => {
    onClick?.(loot.id);
  });

  container.add([glow, ping, body, labelText]);

  return {
    refresh: (nextLoot: TownRoomWorldLootSnapshot) => {
      container.setPosition(nextLoot.x, nextLoot.y);
      labelText.setText(t(nextLoot.label));
    },
    destroy: () => {
      container.destroy(true);
    },
  };
}