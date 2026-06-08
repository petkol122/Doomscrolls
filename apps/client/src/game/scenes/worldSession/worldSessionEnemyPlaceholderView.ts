import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomEnemySnapshot } from "../../../net/townRoomEnemies";

// Task 242 â€” Defensive enemy view lifecycle rule:
//   * the server (TownRoom) is the only authority for spawn / chase /
//     return / defeated / respawn transitions;
//   * the client view is only destroyed when the server removes the
//     enemy from authoritative state (caller stops calling refresh()
//     and the placeholder is destroyed in the area view);
//   * a temporary missing projected position, an off-camera enemy,
//     a player overlap, or a single missing refresh tick must NOT
//     hide or move the view; the view stays at its last known
//     world/screen position until either refresh() with a valid
//     projection or destroy() is called from the area view.
// HIDDEN_POSITION is kept as a constant for future use by the
// server-driven "defeated" corpse visual only â€” it must never be
// applied to a live (non-defeated) enemy placeholder.
const HIDDEN_POSITION = -9999;

// Task 244 â€” how long the "Respawned" label stays visible after the
// server flips the enemy back from defeated -> alive, so the visual
// no longer looks like a random teleport. Server rules are unchanged.
const RESPAWNED_LABEL_DURATION_MS = 1500;

// Task 250 â€” Trashboar family readability batch.
// Distinct placeholder sizing/shape only (no sprites, no animations, no
// new AI/abilities). Skitter is smaller/faster-looking, Runt is the
// baseline, Brute is larger/heavier. Server stats / spawns / loot
// are untouched; only the visual placeholder proportions change.
type TrashboarVariant = "runt" | "skitter" | "brute";

function getTrashboarVariant(enemy: TownRoomEnemySnapshot): TrashboarVariant {
  if (enemy.id.includes("trashboar_brute")) {
    return "brute";
  }
  if (enemy.id.includes("trashboar_skitter")) {
    return "skitter";
  }
  return "runt";
}

interface VariantVisual {
  readonly bodyWidth: number;
  readonly bodyHeight: number;
  readonly coreRadius: number;
  readonly coreOffsetY: number;
  readonly ringWidth: number;
  readonly ringHeight: number;
  readonly ringOffsetY: number;
  readonly shadowWidth: number;
  readonly shadowHeight: number;
  readonly shadowOffsetY: number;
  readonly labelFontSize: string;
  readonly defeatedCrossSize: number;
  readonly defeatedCrossThickness: number;
  readonly defeatedOutlineRadius: number;
}

const VARIANT_VISUALS: Readonly<Record<TrashboarVariant, VariantVisual>> = {
  skitter: {
    bodyWidth: 20,
    bodyHeight: 20,
    coreRadius: 4,
    coreOffsetY: -1,
    ringWidth: 30,
    ringHeight: 14,
    ringOffsetY: 8,
    shadowWidth: 26,
    shadowHeight: 11,
    shadowOffsetY: 10,
    labelFontSize: "11px",
    defeatedCrossSize: 14,
    defeatedCrossThickness: 3,
    defeatedOutlineRadius: 9,
  },
  runt: {
    bodyWidth: 24,
    bodyHeight: 24,
    coreRadius: 5,
    coreOffsetY: -2,
    ringWidth: 36,
    ringHeight: 16,
    ringOffsetY: 10,
    shadowWidth: 30,
    shadowHeight: 14,
    shadowOffsetY: 12,
    labelFontSize: "12px",
    defeatedCrossSize: 18,
    defeatedCrossThickness: 3,
    defeatedOutlineRadius: 11,
  },
  brute: {
    bodyWidth: 32,
    bodyHeight: 30,
    coreRadius: 6,
    coreOffsetY: -4,
    ringWidth: 48,
    ringHeight: 22,
    ringOffsetY: 10,
    shadowWidth: 40,
    shadowHeight: 18,
    shadowOffsetY: 12,
    labelFontSize: "13px",
    defeatedCrossSize: 22,
    defeatedCrossThickness: 4,
    defeatedOutlineRadius: 14,
  },
};

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

  const initialVariant = getTrashboarVariant(enemy);
  const initialVisual = VARIANT_VISUALS[initialVariant];

  const shadow = scene.add.ellipse(
    0,
    initialVisual.shadowOffsetY,
    initialVisual.shadowWidth,
    initialVisual.shadowHeight,
    0x000000,
    0.34,
  );
  const ring = scene.add.ellipse(
    0,
    initialVisual.ringOffsetY,
    initialVisual.ringWidth,
    initialVisual.ringHeight,
    initialVariant === "brute" ? 0x5e2b10 : 0x6f1414,
    0.28,
  );
  ring.setStrokeStyle(2, initialVariant === "brute" ? 0xffc16e : 0xff7a7a, initialVariant === "brute" ? 0.52 : 0.4);
  const body = scene.add.rectangle(
    0,
    0,
    initialVisual.bodyWidth,
    initialVisual.bodyHeight,
    initialVariant === "brute" ? 0x8f4d1e : 0xb12222,
    0.98,
  );
  body.setStrokeStyle(2, initialVariant === "brute" ? 0xffddae : 0xffd0d0, 0.98);
  body.setInteractive({ useHandCursor: true });
  const core = scene.add.circle(
    0,
    initialVisual.coreOffsetY,
    initialVisual.coreRadius,
    initialVariant === "brute" ? 0xffe2b8 : 0xffe2e2,
    0.95,
  );

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
      fontSize: initialVisual.labelFontSize,
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

  // Task 244 â€” defeated "X" cross marker, hidden by default. Shown
  // only while the server reports `defeated: true` so the corpse
  // reads clearly as downed, not just a darker copy of the live
  // enemy. Reuses only existing placeholder shapes (two crossed
  // rectangles + outline), no animations, no new sprites.
  const defeatedCrossV = scene.add.rectangle(0, 0, initialVisual.defeatedCrossThickness, initialVisual.defeatedCrossSize, 0xff3a3a, 0.95);
  const defeatedCrossH = scene.add.rectangle(0, 0, initialVisual.defeatedCrossSize, initialVisual.defeatedCrossThickness, 0xff3a3a, 0.95);
  defeatedCrossV.setStrokeStyle(1, 0x160909, 0.95);
  defeatedCrossH.setStrokeStyle(1, 0x160909, 0.95);
  defeatedCrossV.setVisible(false);
  defeatedCrossH.setVisible(false);
  const defeatedCrossOutline = scene.add.circle(0, 0, initialVisual.defeatedOutlineRadius, 0x1a0808, 0.78);
  defeatedCrossOutline.setStrokeStyle(1, 0xff5a5a, 0.85);
  defeatedCrossOutline.setVisible(false);

  container.add([
    shadow,
    ring,
    body,
    core,
    hpBarFrame,
    hpBarFill,
    hpText,
    labelText,
    stateText,
    telegraphMarker,
    telegraphExclaim,
    heavyTelegraphLabel,
    aggroExclaim,
    defeatedCrossOutline,
    defeatedCrossV,
    defeatedCrossH,
  ]);

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

  let lastDefeated: boolean = enemy.defeated;
  let respawnedAtMs: number | null = null;
  let lastVariant: TrashboarVariant = initialVariant;

  const applyEnemyVisualState = (nextEnemy: TownRoomEnemySnapshot): void => {
    const nextVariant = getTrashboarVariant(nextEnemy);
    const visual = VARIANT_VISUALS[nextVariant];
    const hpRatio = getHpRatio(nextEnemy);
    hpBarFill.setScale(hpRatio, 1);
    hpBarFill.setFillStyle(nextVariant === "brute" ? 0xd88a2f : 0xcf3e3e, 0.98);
    hpBarFrame.setStrokeStyle(1, nextVariant === "brute" ? 0xffdfad : 0xf4d3d3, nextEnemy.defeated ? 0.22 : 0.45);

    if (nextVariant !== lastVariant) {
      shadow.setSize(visual.shadowWidth, visual.shadowHeight);
      shadow.setPosition(0, visual.shadowOffsetY);
      ring.setSize(visual.ringWidth, visual.ringHeight);
      ring.setPosition(0, visual.ringOffsetY);
      body.setSize(visual.bodyWidth, visual.bodyHeight);
      body.setPosition(0, 0);
      core.setRadius(visual.coreRadius);
      core.setPosition(0, visual.coreOffsetY);
      defeatedCrossV.setSize(visual.defeatedCrossThickness, visual.defeatedCrossSize);
      defeatedCrossH.setSize(visual.defeatedCrossSize, visual.defeatedCrossThickness);
      defeatedCrossOutline.setRadius(visual.defeatedOutlineRadius);
      lastVariant = nextVariant;
    }

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
      const squashedBodyWidth = visual.bodyWidth * 1.4;
      const squashedBodyHeight = visual.bodyHeight * 0.5;
      body.setSize(squashedBodyWidth, squashedBodyHeight);
      body.setPosition(0, 4);
      core.setFillStyle(0x9c9c9c, 0.55);
      core.setVisible(false);
      stateText.setColor("#b8b8b8");
      stateText.setText(formatStateText(nextEnemy));
      labelText.setColor("#b8b8b8");
      labelText.setText(`${t(nextEnemy.label)} â€¢ ${t("world_area.enemy_defeated_label")}`);
      hpText.setColor("#b8b8b8");
      hpText.setText(
        t("world_area.enemy_respawning_in", {
          seconds: remainingSeconds,
        }),
      );
      hpBarFill.setVisible(false);
      hpBarFrame.setVisible(false);
      aggroExclaim.setVisible(false);
      defeatedCrossOutline.setVisible(true);
      defeatedCrossOutline.setPosition(0, 2);
      defeatedCrossV.setVisible(true);
      defeatedCrossV.setPosition(0, 2);
      defeatedCrossH.setVisible(true);
      defeatedCrossH.setPosition(0, 2);
      lastDefeated = true;
      respawnedAtMs = null;
      return;
    }

    if (body.width !== visual.bodyWidth || body.height !== visual.bodyHeight) {
      body.setSize(visual.bodyWidth, visual.bodyHeight);
    }
    body.setPosition(0, 0);
    core.setVisible(true);
    defeatedCrossOutline.setVisible(false);
    defeatedCrossV.setVisible(false);
    defeatedCrossH.setVisible(false);
    hpBarFrame.setVisible(true);

    hpBarFill.setVisible(true);
    shadow.setFillStyle(0x000000, 0.28);
    if (nextEnemy.state === "chasing") {
      ring.setFillStyle(nextVariant === "brute" ? 0x7a1a05 : 0x6b0a0a, 0.55);
      ring.setStrokeStyle(3, 0xff3a1a, 0.95);
      body.setFillStyle(nextVariant === "brute" ? 0xff5a1a : 0xff2a1a, 1);
      body.setStrokeStyle(3, 0xffe066, 1);
      core.setFillStyle(nextVariant === "brute" ? 0xffe066 : 0xfff0aa, 1);
      core.setScale(1.4);
      stateText.setColor("#ff3a1a");
      aggroExclaim.setVisible(true);
    } else if (nextEnemy.state === "returning") {
      ring.setFillStyle(0x2b466f, 0.3);
      ring.setStrokeStyle(2, 0x8ab8ff, 0.48);
      body.setFillStyle(nextVariant === "brute" ? 0x597eb3 : 0x426ca8, 0.95);
      body.setStrokeStyle(2, 0xbfd8ff, 0.95);
      stateText.setColor("#cfe0ff");
      aggroExclaim.setVisible(false);
      core.setScale(1);
    } else {
      ring.setFillStyle(nextVariant === "brute" ? 0x5e2b10 : 0x6f1414, 0.28);
      ring.setStrokeStyle(2, nextVariant === "brute" ? 0xffc16e : 0xff7a7a, nextVariant === "brute" ? 0.52 : 0.4);
      body.setFillStyle(nextVariant === "brute" ? 0x8f4d1e : 0xb12222, 0.95);
      body.setStrokeStyle(2, nextVariant === "brute" ? 0xffddae : 0xf0b0b0, 0.95);
      stateText.setColor("#d7d7ff");
      aggroExclaim.setVisible(false);
      core.setScale(1);
    }
    body.setInteractive({ useHandCursor: true });
    stateText.setText(formatStateText(nextEnemy));
    labelText.setColor("#ffffff");
    labelText.setText(t(nextEnemy.label));
    if (lastDefeated === true && nextEnemy.defeated === false) {
      respawnedAtMs = Date.now();
    }
    lastDefeated = nextEnemy.defeated;
    if (
      respawnedAtMs !== null
      && Date.now() - respawnedAtMs < RESPAWNED_LABEL_DURATION_MS
    ) {
      hpText.setColor("#b8e0ff");
      hpText.setText(t("world_area.enemy_respawned_label"));
    } else {
      respawnedAtMs = null;
      hpText.setColor("#ffdddd");
      hpText.setText(`${nextEnemy.hp}/${nextEnemy.maxHp} HP`);
    }
  };

  const hide = (): void => {
    container.setPosition(HIDDEN_POSITION, HIDDEN_POSITION);
  };

  const refresh = (nextEnemy: TownRoomEnemySnapshot): void => {
    container.setPosition(nextEnemy.x, nextEnemy.y);
    container.setDepth(400 + nextEnemy.y);
    applyEnemyVisualState(nextEnemy);
  };

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

