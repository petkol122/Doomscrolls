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
  readonly setTelegraphing: (active: boolean, attackKind?: "normal" | "heavy") => void;
  readonly destroy: () => void;
}

export function createWorldSessionEnemyPlaceholderView(
  scene: Phaser.Scene,
  enemy: TownRoomEnemySnapshot,
  parentContainer?: Phaser.GameObjects.Container,
  onClick?: (enemyId: string) => void,
): WorldSessionEnemyPlaceholderView {
  const container = scene.add.container(enemy.x, enemy.y);
  container.setDepth(400);
  parentContainer?.add(container);

  const isBrute = isBruteEnemy(enemy);

  const shadow = scene.add.ellipse(0, 12, isBrute ? 40 : 30, isBrute ? 18 : 14, 0x000000, 0.34);
  const ring = scene.add.ellipse(0, 10, isBrute ? 48 : 36, isBrute ? 22 : 16, isBrute ? 0x5e2b10 : 0x6f1414, 0.28);
  ring.setStrokeStyle(2, isBrute ? 0xffc16e : 0xff7a7a, isBrute ? 0.52 : 0.4);
  const body = scene.add.rectangle(0, 0, isBrute ? 32 : 24, isBrute ? 30 : 24, isBrute ? 0x8f4d1e : 0xb12222, 0.98);
  body.setStrokeStyle(2, isBrute ? 0xffddae : 0xffd0d0, 0.98);
  body.setInteractive({ useHandCursor: true });
  const core = scene.add.circle(0, isBrute ? -4 : -2, isBrute ? 6 : 5, isBrute ? 0xffe2b8 : 0xffe2e2, 0.95);

  // Task 206 -- an "enraged" exclamation marker that is shown only
  // while the enemy is in the `chasing` state. The marker is purely
  // visual and reuses only existing placeholder shapes (a single
  // text element); the server still owns the chase state and damage
  // outcome.
  const aggroExclaim = scene.add
    .text(0, -52, "!", {
      color: "#ff2a1a",
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#160909",
      strokeThickness: 4,
    })
    .setOrigin(0.5);
  aggroExclaim.setVisible(false);

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

  const heavyTelegraphLabel = scene.add
    .text(0, -29, "HEAVY!", {
      color: "#fff1d6",
      fontFamily: "Arial, sans-serif",
      fontSize: "10px",
      fontStyle: "bold",
      stroke: "#2a0600",
      strokeThickness: 3,
      backgroundColor: "#7a1408",
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    })
    .setOrigin(0.5);
  heavyTelegraphLabel.setVisible(false);

  container.add([shadow, ring, body, core, hpBarFrame, hpBarFill, hpText, labelText, stateText, telegraphMarker, telegraphExclaim, heavyTelegraphLabel, aggroExclaim]);

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
      aggroExclaim.setVisible(false);
      core.setScale(1);
      return;
    }

    hpBarFill.setVisible(true);
    shadow.setFillStyle(0x000000, 0.28);
    if (nextEnemy.state === "chasing") {
      // Task 206 -- make aggro/chasing state much clearer in the
      // existing placeholder visual: a brighter, more saturated red
      // body, a glowing yellow ring, an enlarged inner core, an
      // "enraged" state label, and a floating "!" above the enemy.
      // The visual still reuses only the existing placeholder
      // shapes (no animations, no new sprites).
      ring.setFillStyle(nextIsBrute ? 0x7a1a05 : 0x6b0a0a, 0.55);
      ring.setStrokeStyle(3, 0xff3a1a, 0.95);
      body.setFillStyle(nextIsBrute ? 0xff5a1a : 0xff2a1a, 1);
      body.setStrokeStyle(3, 0xffe066, 1);
      core.setFillStyle(nextIsBrute ? 0xffe066 : 0xfff0aa, 1);
      core.setScale(1.4);
      stateText.setColor("#ff3a1a");
      aggroExclaim.setVisible(true);
    } else if (nextEnemy.state === "returning") {
      ring.setFillStyle(0x2b466f, 0.3);
      ring.setStrokeStyle(2, 0x8ab8ff, 0.48);
      body.setFillStyle(nextIsBrute ? 0x597eb3 : 0x426ca8, 0.95);
      body.setStrokeStyle(2, 0xbfd8ff, 0.95);
      stateText.setColor("#cfe0ff");
      aggroExclaim.setVisible(false);
      core.setScale(1);
    } else {
      ring.setFillStyle(nextIsBrute ? 0x5e2b10 : 0x6f1414, 0.28);
      ring.setStrokeStyle(2, nextIsBrute ? 0xffc16e : 0xff7a7a, nextIsBrute ? 0.52 : 0.4);
      body.setFillStyle(nextIsBrute ? 0x8f4d1e : 0xb12222, 0.95);
      body.setStrokeStyle(2, nextIsBrute ? 0xffddae : 0xf0b0b0, 0.95);
      stateText.setColor("#d7d7ff");
      aggroExclaim.setVisible(false);
      core.setScale(1);
    }
    body.setInteractive({ useHandCursor: true });
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
    container.setDepth(400 + nextEnemy.y);
    applyEnemyVisualState(nextEnemy);
  };

  // Task 094 - show or hide the telegraph warning marker. Driven
  // exclusively by the server-sent `enemy_attack_telegraph` event.
  let telegraphTween: Phaser.Tweens.Tween | null = null;
  const setTelegraphing = (active: boolean, attackKind: "normal" | "heavy" = "normal"): void => {
    const isHeavy = attackKind === "heavy";
    telegraphMarker.setFillStyle(isHeavy ? 0xff6a3d : 0xffe14a, 0.95);
    telegraphMarker.setStrokeStyle(2, isHeavy ? 0x5c1200 : 0x6b4a00, 0.9);
    telegraphExclaim.setText(isHeavy ? "!!" : "!");
    telegraphExclaim.setColor(isHeavy ? "#fff3e0" : "#1a0e00");
    telegraphMarker.setVisible(active);
    telegraphExclaim.setVisible(active);
    heavyTelegraphLabel.setVisible(active && isHeavy);
    if (active) {
      if (telegraphTween === null) {
        telegraphTween = scene.tweens.add({
          targets: [telegraphMarker, telegraphExclaim, heavyTelegraphLabel],
          scaleX: isHeavy ? 1.22 : 1.15,
          scaleY: isHeavy ? 1.22 : 1.15,
          yoyo: true,
          duration: isHeavy ? 135 : 110,
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
      heavyTelegraphLabel.setScale(1);
      heavyTelegraphLabel.setVisible(false);
    }
  };

  applyEnemyVisualState(enemy);
  container.setDepth(400 + enemy.y);

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
