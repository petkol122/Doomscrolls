import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomEnemySnapshot } from "../../../net/townRoomEnemies";

const HIDDEN_POSITION = -9999;

export interface WorldSessionEnemyPlaceholderView {
  readonly refresh: (enemy: TownRoomEnemySnapshot) => void;
  readonly hide: () => void;
  // Task 094 - show or hide the enemy attack telegraph warning marker.
  readonly setTelegraphing: (active: boolean) => void;
  readonly destroy: () => void;
}

export function createWorldSessionEnemyPlaceholderView(
  scene: Phaser.Scene,
  enemy: TownRoomEnemySnapshot,
  onClick?: (enemyId: string) => void,
): WorldSessionEnemyPlaceholderView {
  const container = scene.add.container(enemy.x, enemy.y);

  const shadow = scene.add.ellipse(0, 11, 30, 14, 0x000000, 0.34);
  const ring = scene.add.ellipse(0, 9, 36, 16, 0x6f1414, 0.26);
  ring.setStrokeStyle(2, 0xff7a7a, 0.4);
  const body = scene.add.rectangle(0, 0, 24, 24, 0xb12222, 0.98);
  body.setStrokeStyle(2, 0xffd0d0, 0.98);
  body.setInteractive({ useHandCursor: true });
  const core = scene.add.circle(0, -2, 5, 0xffe2e2, 0.95);

  const labelText = scene.add
    .text(0, 15, t(enemy.label) + ` (${enemy.hp}/${enemy.maxHp})`, {
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      stroke: "#160909",
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  const hpText = scene.add
    .text(0, -24, `HP ${enemy.hp}/${enemy.maxHp}`, {
      color: "#ffe5e5",
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      stroke: "#160909",
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  const stateText = scene.add
    .text(0, -38, "", {
      color: "#d7d7ff",
      fontFamily: "Arial, sans-serif",
      fontSize: "10px",
      stroke: "#160909",
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  // Task 094 - telegraph warning marker. A pulsing yellow triangle
  // above the enemy that is shown only during the enemy attack windup.
  // The marker is purely visual; the server still decides when the
  // actual damage lands. The marker is hidden by default.
  const telegraphMarker = scene.add.triangle(0, -22, 0, 0, 18, 0, 9, 18, 0xffe14a, 0.95);
  telegraphMarker.setStrokeStyle(2, 0x6b4a00, 0.9);
  telegraphMarker.setVisible(false);
  const telegraphExclaim = scene.add
    .text(0, -19, "!", {
      color: "#1a0e00",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  telegraphExclaim.setVisible(false);

  container.add([shadow, ring, body, core, stateText, hpText, labelText, telegraphMarker, telegraphExclaim]);

  body.on(Phaser.Input.Events.POINTER_DOWN, () => {
    onClick?.(enemy.id);
  });

  const formatStateText = (nextEnemy: TownRoomEnemySnapshot): string => {
    if (nextEnemy.defeated) {
      return "state=defeated";
    }

    if (nextEnemy.targetPlayerSessionId.length > 0) {
      return `state=${nextEnemy.state} target=${nextEnemy.targetPlayerSessionId}`;
    }

    if (nextEnemy.state === "returning") {
      return "state=returning home";
    }

    return `state=${nextEnemy.state}`;
  };

  const applyEnemyVisualState = (nextEnemy: TownRoomEnemySnapshot): void => {
    if (nextEnemy.defeated) {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((nextEnemy.respawnAtMs - Date.now()) / 1000),
      );
      shadow.setFillStyle(0x000000, 0.18);
      ring.setFillStyle(0x3a3a3a, 0.14);
      ring.setStrokeStyle(2, 0x9a9a9a, 0.24);
      body.setFillStyle(0x4a4a4a, 0.75);
      body.setStrokeStyle(2, 0x9a9a9a, 0.7);
      body.disableInteractive();
      core.setFillStyle(0x9c9c9c, 0.55);
      stateText.setColor("#b8b8b8");
      stateText.setText(formatStateText(nextEnemy));
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
    if (nextEnemy.state === "chasing") {
      ring.setFillStyle(0x8a4515, 0.32);
      ring.setStrokeStyle(2, 0xffc27a, 0.5);
      body.setFillStyle(0xc8611d, 0.95);
      body.setStrokeStyle(2, 0xffd3a3, 0.95);
      stateText.setColor("#ffe0aa");
    } else if (nextEnemy.state === "returning") {
      ring.setFillStyle(0x2b466f, 0.3);
      ring.setStrokeStyle(2, 0x8ab8ff, 0.48);
      body.setFillStyle(0x426ca8, 0.95);
      body.setStrokeStyle(2, 0xbfd8ff, 0.95);
      stateText.setColor("#cfe0ff");
    } else {
      ring.setFillStyle(0x6f1414, 0.26);
      ring.setStrokeStyle(2, 0xff7a7a, 0.4);
      body.setFillStyle(0xb12222, 0.95);
      body.setStrokeStyle(2, 0xf0b0b0, 0.95);
      stateText.setColor("#d7d7ff");
    }
    body.setInteractive({ useHandCursor: true });
    core.setFillStyle(0xffd7d7, 0.9);
    stateText.setText(formatStateText(nextEnemy));
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

  // Task 094 - show or hide the telegraph warning marker. Driven
  // exclusively by the server-sent `enemy_attack_telegraph` event.
  let telegraphTween: Phaser.Tweens.Tween | null = null;
  const setTelegraphing = (active: boolean): void => {
    telegraphMarker.setVisible(active);
    telegraphExclaim.setVisible(active);
    if (active) {
      if (telegraphTween === null) {
        telegraphTween = scene.tweens.add({
          targets: [telegraphMarker, telegraphExclaim],
          scaleX: 1.15,
          scaleY: 1.15,
          yoyo: true,
          duration: 110,
          repeat: -1,
        });
      } else if (!telegraphTween.isPlaying()) {
        telegraphTween.restart();
      }
    } else if (telegraphTween !== null) {
      telegraphTween.stop();
      telegraphTween = null;
      telegraphMarker.setScale(1);
      telegraphExclaim.setScale(1);
    }
  };

  applyEnemyVisualState(enemy);

  return {
    refresh,
    hide,
    setTelegraphing,
    destroy: () => {
      if (telegraphTween !== null) {
        telegraphTween.stop();
        telegraphTween = null;
      }
      container.destroy(true);
    },
  };
}
