import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomEnemySnapshot } from "../../../net/townRoomEnemies";

const HIDDEN_POSITION = -9999;

function isBruteEnemy(enemy: TownRoomEnemySnapshot): boolean {
  return enemy.id.includes("trashboar_brute");
}

function getHpRatio(enemy: TownRoomEnemySnapshot): number {
  if (enemy.maxHp <= 0) {
    return 0;
  }

  return Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
}

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
  parentContainer?: Phaser.GameObjects.Container,
  onClick?: (enemyId: string) => void,
): WorldSessionEnemyPlaceholderView {
  const container = scene.add.container(enemy.x, enemy.y);
  parentContainer?.add(container);

  const isBrute = isBruteEnemy(enemy);

  const shadow = scene.add.ellipse(0, 12, isBrute ? 40 : 30, isBrute ? 18 : 14, 0x000000, 0.34);
  const ring = scene.add.ellipse(0, 10, isBrute ? 48 : 36, isBrute ? 22 : 16, isBrute ? 0x5e2b10 : 0x6f1414, 0.28);
  ring.setStrokeStyle(2, isBrute ? 0xffc16e : 0xff7a7a, isBrute ? 0.52 : 0.4);
  const body = scene.add.rectangle(0, 0, isBrute ? 32 : 24, isBrute ? 30 : 24, isBrute ? 0x8f4d1e : 0xb12222, 0.98);
  body.setStrokeStyle(2, isBrute ? 0xffddae : 0xffd0d0, 0.98);
  body.setInteractive({ useHandCursor: true });
  const core = scene.add.circle(0, isBrute ? -4 : -2, isBrute ? 6 : 5, isBrute ? 0xffe2b8 : 0xffe2e2, 0.95);

  const hpBarFrame = scene.add.rectangle(0, -31, 44, 8, 0x120707, 0.92);
  hpBarFrame.setStrokeStyle(1, 0xf4d3d3, 0.45);
  const hpBarFill = scene.add.rectangle(-21, -31, 42, 4, 0xcf3e3e, 0.98).setOrigin(0, 0.5);

  const labelText = scene.add
    .text(0, 22, t(enemy.label), {
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontSize: isBrute ? "13px" : "12px",
      fontStyle: "bold",
      stroke: "#160909",
      strokeThickness: 4,
    })
    .setOrigin(0.5);
  const hpText = scene.add
    .text(0, -43, `${enemy.hp}/${enemy.maxHp} HP`, {
      color: "#ffe5e5",
      fontFamily: "Arial, sans-serif",
      fontSize: "10px",
      stroke: "#160909",
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  const stateText = scene.add
    .text(0, 34, "", {
      color: "#d7d7ff",
      fontFamily: "Arial, sans-serif",
      fontSize: "8px",
      stroke: "#160909",
      strokeThickness: 2,
    })
    .setOrigin(0.5);

  // Task 094 - telegraph warning marker. A pulsing yellow triangle
  // above the enemy that is shown only during the enemy attack windup.
  // The marker is purely visual; the server still decides when the
  // actual damage lands. The marker is hidden by default.
  const telegraphMarker = scene.add.triangle(0, -14, 0, 0, 18, 0, 9, 18, 0xffe14a, 0.95);
  telegraphMarker.setStrokeStyle(2, 0x6b4a00, 0.9);
  telegraphMarker.setVisible(false);
  const telegraphExclaim = scene.add
    .text(0, -11, "!", {
      color: "#1a0e00",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  telegraphExclaim.setVisible(false);

  container.add([shadow, ring, body, core, hpBarFrame, hpBarFill, hpText, labelText, stateText, telegraphMarker, telegraphExclaim]);

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
    const nextIsBrute = isBruteEnemy(nextEnemy);
    const hpRatio = getHpRatio(nextEnemy);
    hpBarFill.setScale(hpRatio, 1);
    hpBarFill.setFillStyle(nextIsBrute ? 0xd88a2f : 0xcf3e3e, 0.98);
    hpBarFrame.setStrokeStyle(1, nextIsBrute ? 0xffdfad : 0xf4d3d3, nextEnemy.defeated ? 0.22 : 0.45);

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
      labelText.setText(`${t(nextEnemy.label)} • ${t("world_area.enemy_defeated_label")}`);
      hpText.setColor("#b8b8b8");
      hpText.setText(
        t("world_area.enemy_respawning_in", {
          seconds: remainingSeconds,
        }),
      );
      hpBarFill.setVisible(false);
      return;
    }

    hpBarFill.setVisible(true);
    shadow.setFillStyle(0x000000, 0.28);
    if (nextEnemy.state === "chasing") {
      ring.setFillStyle(nextIsBrute ? 0x8a4f1e : 0x8a4515, 0.34);
      ring.setStrokeStyle(2, 0xffc27a, nextIsBrute ? 0.65 : 0.5);
      body.setFillStyle(nextIsBrute ? 0xd07c25 : 0xc8611d, 0.95);
      body.setStrokeStyle(2, nextIsBrute ? 0xffe0b6 : 0xffd3a3, 0.95);
      stateText.setColor("#ffe0aa");
    } else if (nextEnemy.state === "returning") {
      ring.setFillStyle(0x2b466f, 0.3);
      ring.setStrokeStyle(2, 0x8ab8ff, 0.48);
      body.setFillStyle(nextIsBrute ? 0x597eb3 : 0x426ca8, 0.95);
      body.setStrokeStyle(2, 0xbfd8ff, 0.95);
      stateText.setColor("#cfe0ff");
    } else {
      ring.setFillStyle(nextIsBrute ? 0x5e2b10 : 0x6f1414, 0.28);
      ring.setStrokeStyle(2, nextIsBrute ? 0xffc16e : 0xff7a7a, nextIsBrute ? 0.52 : 0.4);
      body.setFillStyle(nextIsBrute ? 0x8f4d1e : 0xb12222, 0.95);
      body.setStrokeStyle(2, nextIsBrute ? 0xffddae : 0xf0b0b0, 0.95);
      stateText.setColor("#d7d7ff");
    }
    body.setInteractive({ useHandCursor: true });
    core.setFillStyle(nextIsBrute ? 0xffdfba : 0xffd7d7, 0.9);
    stateText.setText(formatStateText(nextEnemy));
    labelText.setColor("#ffffff");
    labelText.setText(t(nextEnemy.label));
    hpText.setColor("#ffdddd");
    hpText.setText(`${nextEnemy.hp}/${nextEnemy.maxHp} HP`);
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
