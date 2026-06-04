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
  onClick?: (worldLootId: string) => void,
): WorldSessionLootPlaceholderView {
  const container = scene.add.container(loot.x, loot.y);
  const glow = scene.add.ellipse(0, 10, 22, 10, 0xe7c66d, 0.2);
  const body = scene.add.rectangle(0, 0, 14, 14, 0xd4aa3d, 0.95);
  body.setStrokeStyle(2, 0xffefb3, 0.95);
  body.setInteractive({ useHandCursor: true });
  const labelText = scene.add
    .text(0, 16, t(loot.label), {
      color: "#ffe7a8",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
    })
    .setOrigin(0.5);

  body.on(Phaser.Input.Events.POINTER_DOWN, () => {
    onClick?.(loot.id);
  });

  container.add([glow, body, labelText]);

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