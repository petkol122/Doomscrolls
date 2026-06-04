import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomEnemySnapshot } from "../../../net/townRoomEnemies";

const HIDDEN_POSITION = -9999;

export interface WorldSessionEnemyPlaceholderView {
  readonly refresh: (enemy: TownRoomEnemySnapshot) => void;
  readonly hide: () => void;
  readonly destroy: () => void;
}

export function createWorldSessionEnemyPlaceholderView(
  scene: Phaser.Scene,
  enemy: TownRoomEnemySnapshot,
  onClick?: (enemyId: string) => void,
): WorldSessionEnemyPlaceholderView {
  const container = scene.add.container(enemy.x, enemy.y);

  const shadow = scene.add.ellipse(0, 10, 26, 12, 0x000000, 0.28);
  const body = scene.add.rectangle(0, 0, 22, 22, 0xb12222, 0.95);
  body.setStrokeStyle(2, 0xf0b0b0, 0.95);
  body.setInteractive({ useHandCursor: true });
  const core = scene.add.circle(0, -2, 4, 0xffd7d7, 0.9);

  const labelText = scene.add
    .text(0, 15, t(enemy.label) + ` (${enemy.hp}/${enemy.maxHp})`, {
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
    })
    .setOrigin(0.5);
  const hpText = scene.add
    .text(0, -24, `HP ${enemy.hp}/${enemy.maxHp}`, {
      color: "#ffdddd",
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
    })
    .setOrigin(0.5);

  container.add([shadow, body, core, hpText, labelText]);

  body.on(Phaser.Input.Events.POINTER_DOWN, () => {
    onClick?.(enemy.id);
  });

  const applyEnemyVisualState = (nextEnemy: TownRoomEnemySnapshot): void => {
    if (nextEnemy.defeated) {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((nextEnemy.respawnAtMs - Date.now()) / 1000),
      );
      shadow.setFillStyle(0x000000, 0.18);
      body.setFillStyle(0x4a4a4a, 0.75);
      body.setStrokeStyle(2, 0x9a9a9a, 0.7);
      body.disableInteractive();
      core.setFillStyle(0x9c9c9c, 0.55);
      labelText.setColor("#b8b8b8");
      labelText.setText(
        `${t(nextEnemy.label)} (${t("world_area.enemy_defeated_label")})`,
      );
      hpText.setColor("#b8b8b8");
      hpText.setText(
        t("world_area.enemy_respawning_in", {
          seconds: remainingSeconds,
        }),
      );
      return;
    }

    shadow.setFillStyle(0x000000, 0.28);
    body.setFillStyle(0xb12222, 0.95);
    body.setStrokeStyle(2, 0xf0b0b0, 0.95);
    body.setInteractive({ useHandCursor: true });
    core.setFillStyle(0xffd7d7, 0.9);
    labelText.setColor("#ffffff");
    labelText.setText(`${t(nextEnemy.label)} (${nextEnemy.hp}/${nextEnemy.maxHp})`);
    hpText.setColor("#ffdddd");
    hpText.setText(`HP ${nextEnemy.hp}/${nextEnemy.maxHp}`);
  };

  const hide = (): void => {
    container.setPosition(HIDDEN_POSITION, HIDDEN_POSITION);
  };

  const refresh = (nextEnemy: TownRoomEnemySnapshot): void => {
    container.setPosition(nextEnemy.x, nextEnemy.y);
    applyEnemyVisualState(nextEnemy);
  };

  applyEnemyVisualState(enemy);

  return {
    refresh,
    hide,
    destroy: () => {
      container.destroy(true);
    },
  };
}
