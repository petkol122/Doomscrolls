import { t } from "@doomscrolls/localization";
import Phaser from "phaser";
import { contentRegistry } from "@doomscrolls/content";

import type { TownRoomEnemySnapshot } from "../../../net/townRoomEnemies";
import { ENEMY_HP_BAR_ASSET_ID } from "../../visualAssetLoader";

// Core 0.23 -- bdragon1727's health-bar strip (see visualAssets.ts) has 8
// frames, but only frames 0-5 share a consistent footprint; frames 6-7 are
// a visibly smaller "critical" variant that would jump size if included in
// the same gradient, so only the first 6 are ever selected here.
const HP_BAR_USABLE_FRAMES = 6;
const HP_BAR_DISPLAY_WIDTH = 28;
const HP_BAR_DISPLAY_HEIGHT = 14;

function resolveHpBarFrame(hpRatio: number): number {
  return Phaser.Math.Clamp(
    Math.round((1 - hpRatio) * (HP_BAR_USABLE_FRAMES - 1)),
    0,
    HP_BAR_USABLE_FRAMES - 1,
  );
}

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

// Core 0.33 follow-up -- every enemy's placeholder visual is now looked
// up by its real content-defined spriteKey (packages/content/src/data/
// enemies.ts), never guessed from a substring match on the enemy's
// opaque instance id. Replaces the old 3-bucket Trashboar-only mapping,
// whose silent "runt" fallback made all 9 non-Trashboar enemy types
// (every enemy in Static Yard, Cinderworks, and Saltmere Docks) render
// identically. One real entry per real spriteKey below; an enemy whose
// content lookup fails (should not happen -- caught by content
// validation) falls back to DEFAULT_SPRITE_KEY's own distinct
// "unrecognized" look, not a silent match to any real enemy.
const DEFAULT_SPRITE_KEY = "enemy_unknown_placeholder";

function resolveEnemySpriteKey(enemy: TownRoomEnemySnapshot): string {
  // `EnemyId` isn't part of either package's public export surface, so
  // this matches the server's own established pattern for the same
  // situation (an id that arrives as a plain string at a network/content
  // boundary) -- see apps/server/src/realtime/rooms/rollLoot.ts's
  // identical `as never` cast into `contentRegistry.enemies.get`.
  const enemyDefinition = contentRegistry.enemies.get(enemy.enemyId as never);
  return enemyDefinition?.spriteKey ?? DEFAULT_SPRITE_KEY;
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
  // Idle-state coloring -- the enemy's own real visual identity. Chasing/
  // returning stay universal (see applyEnemyVisualState) so "is this
  // hostile right now" reads instantly regardless of which enemy it is.
  readonly idleBodyColor: number;
  readonly idleBodyStroke: number;
  readonly idleRingColor: number;
  readonly idleRingAlpha: number;
  readonly idleRingStroke: number;
  readonly idleRingStrokeAlpha: number;
  readonly idleCoreColor: number;
}

// Three real size tiers, derived from each enemy's own real maxHp/moveSpeed
// (packages/content/src/data/enemies.ts) -- heavy anchors (maxHp 30-34,
// heavy-attack capable) are largest, fast skirmishers (moveSpeed >= 1.25)
// are smallest, common/starter-tier enemies sit in between. Four distinct
// color families, one per zone (sewer/Blackwire = red-rust, Static Yard =
// electric blue, Cinderworks = molten orange, Saltmere Docks = brine teal),
// so every one of the 12 real enemy types reads as visually its own thing.
const SIZE_HEAVY = {
  bodyWidth: 32, bodyHeight: 30, coreRadius: 6, coreOffsetY: -4,
  ringWidth: 48, ringHeight: 22, ringOffsetY: 10,
  shadowWidth: 40, shadowHeight: 18, shadowOffsetY: 12,
  labelFontSize: "13px", defeatedCrossSize: 22, defeatedCrossThickness: 4, defeatedOutlineRadius: 14,
};
const SIZE_SKIRMISHER = {
  bodyWidth: 20, bodyHeight: 20, coreRadius: 4, coreOffsetY: -1,
  ringWidth: 30, ringHeight: 14, ringOffsetY: 8,
  shadowWidth: 26, shadowHeight: 11, shadowOffsetY: 10,
  labelFontSize: "11px", defeatedCrossSize: 14, defeatedCrossThickness: 3, defeatedOutlineRadius: 9,
};
const SIZE_COMMON = {
  bodyWidth: 24, bodyHeight: 24, coreRadius: 5, coreOffsetY: -2,
  ringWidth: 36, ringHeight: 16, ringOffsetY: 10,
  shadowWidth: 30, shadowHeight: 14, shadowOffsetY: 12,
  labelFontSize: "12px", defeatedCrossSize: 18, defeatedCrossThickness: 3, defeatedOutlineRadius: 11,
};

// A genuinely unrecognized spriteKey, not a stand-in for any real enemy.
// Distinct neutral gray so a content gap is visually obvious instead of
// silently matching a real type. Should never be reached in practice --
// content validation guarantees every enemyId resolves.
const DEFAULT_VARIANT_VISUAL: VariantVisual = {
  ...SIZE_COMMON,
  idleBodyColor: 0x555555, idleBodyStroke: 0xcccccc,
  idleRingColor: 0x333333, idleRingAlpha: 0.26, idleRingStroke: 0x999999, idleRingStrokeAlpha: 0.36,
  idleCoreColor: 0xdddddd,
};

const VARIANT_VISUALS: Readonly<Record<string, VariantVisual>> = {
  // ── Sewer family (Blackwire Sewers / Nightmarket's reused ambient pockets) ──
  enemy_trashboar_runt_placeholder: {
    ...SIZE_COMMON,
    idleBodyColor: 0xb12222, idleBodyStroke: 0xf0b0b0,
    idleRingColor: 0x6f1414, idleRingAlpha: 0.28, idleRingStroke: 0xff7a7a, idleRingStrokeAlpha: 0.4,
    idleCoreColor: 0xffe2e2,
  },
  enemy_trashboar_skitter_placeholder: {
    ...SIZE_SKIRMISHER,
    idleBodyColor: 0xd14a4a, idleBodyStroke: 0xffd0d0,
    idleRingColor: 0x7a2020, idleRingAlpha: 0.28, idleRingStroke: 0xff9a9a, idleRingStrokeAlpha: 0.42,
    idleCoreColor: 0xffe8e8,
  },
  enemy_trashboar_brute_placeholder: {
    ...SIZE_HEAVY,
    idleBodyColor: 0x8f4d1e, idleBodyStroke: 0xffddae,
    idleRingColor: 0x5e2b10, idleRingAlpha: 0.28, idleRingStroke: 0xffc16e, idleRingStrokeAlpha: 0.52,
    idleCoreColor: 0xffe2b8,
  },
  // ── Static Yard family (electric blue/yellow) ──
  enemy_static_wretch_placeholder: {
    ...SIZE_COMMON,
    idleBodyColor: 0x2f5f7a, idleBodyStroke: 0xbfe8ff,
    idleRingColor: 0x1a3a4a, idleRingAlpha: 0.28, idleRingStroke: 0x6fd0ff, idleRingStrokeAlpha: 0.42,
    idleCoreColor: 0xdff6ff,
  },
  enemy_yard_drudge_placeholder: {
    ...SIZE_COMMON,
    idleBodyColor: 0x3a5568, idleBodyStroke: 0xa8c8d8,
    idleRingColor: 0x24343f, idleRingAlpha: 0.26, idleRingStroke: 0x7fa8bf, idleRingStrokeAlpha: 0.36,
    idleCoreColor: 0xc8e4ee,
  },
  enemy_arc_sentinel_placeholder: {
    ...SIZE_HEAVY,
    idleBodyColor: 0x4a7a8f, idleBodyStroke: 0xfff2a8,
    idleRingColor: 0x1f4a5c, idleRingAlpha: 0.32, idleRingStroke: 0xfff066, idleRingStrokeAlpha: 0.6,
    idleCoreColor: 0xfffbcc,
  },
  // ── Cinderworks family (molten orange/ash) ──
  enemy_slag_hound_placeholder: {
    ...SIZE_SKIRMISHER,
    idleBodyColor: 0xb5451a, idleBodyStroke: 0xffcf9e,
    idleRingColor: 0x6f2a0c, idleRingAlpha: 0.3, idleRingStroke: 0xff9a4a, idleRingStrokeAlpha: 0.46,
    idleCoreColor: 0xffe0b0,
  },
  enemy_ash_rat_placeholder: {
    ...SIZE_COMMON,
    idleBodyColor: 0x5a4f47, idleBodyStroke: 0xcfc4b8,
    idleRingColor: 0x352d28, idleRingAlpha: 0.26, idleRingStroke: 0x9a8f80, idleRingStrokeAlpha: 0.34,
    idleCoreColor: 0xe4dcd0,
  },
  enemy_foundry_warden_placeholder: {
    ...SIZE_HEAVY,
    idleBodyColor: 0x6e1a12, idleBodyStroke: 0xffb08a,
    idleRingColor: 0x3a0c08, idleRingAlpha: 0.34, idleRingStroke: 0xff5a2a, idleRingStrokeAlpha: 0.55,
    idleCoreColor: 0xffceac,
  },
  // ── Saltmere Docks family (brine teal) ──
  enemy_brine_crawler_placeholder: {
    ...SIZE_COMMON,
    idleBodyColor: 0x1f6e63, idleBodyStroke: 0xa8f0e0,
    idleRingColor: 0x123f38, idleRingAlpha: 0.28, idleRingStroke: 0x5adfca, idleRingStrokeAlpha: 0.42,
    idleCoreColor: 0xd6fff5,
  },
  enemy_tide_stalker_placeholder: {
    ...SIZE_SKIRMISHER,
    idleBodyColor: 0x2c8a80, idleBodyStroke: 0xc0fff2,
    idleRingColor: 0x184e47, idleRingAlpha: 0.28, idleRingStroke: 0x7cf0de, idleRingStrokeAlpha: 0.44,
    idleCoreColor: 0xe8fffa,
  },
  enemy_drowned_hauler_placeholder: {
    ...SIZE_HEAVY,
    idleBodyColor: 0x143d3a, idleBodyStroke: 0x8fd8cc,
    idleRingColor: 0x0a201e, idleRingAlpha: 0.34, idleRingStroke: 0x3aab99, idleRingStrokeAlpha: 0.55,
    idleCoreColor: 0xbdeee2,
  },
  [DEFAULT_SPRITE_KEY]: DEFAULT_VARIANT_VISUAL,
};

// A real, non-indexed reference to the fallback visual -- so
// `resolveVariantVisual` below never has to treat the fallback lookup
// itself as possibly-undefined (VARIANT_VISUALS is a plain
// Record<string, VariantVisual>, and this project's tsconfig has
// noUncheckedIndexedAccess on).
function resolveVariantVisual(spriteKey: string): VariantVisual {
  return VARIANT_VISUALS[spriteKey] ?? DEFAULT_VARIANT_VISUAL;
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
  // Task 310 — brief white-flash tint when a server-confirmed hit lands.
  readonly flashHit: () => void;
  // Task 314 — show/hide hover highlight ring around this enemy.
  readonly setHovered: (hovered: boolean) => void;
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

  const initialSpriteKey = resolveEnemySpriteKey(enemy);
  const initialVisual = resolveVariantVisual(initialSpriteKey);

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
    initialVisual.idleRingColor,
    initialVisual.idleRingAlpha,
  );
  ring.setStrokeStyle(2, initialVisual.idleRingStroke, initialVisual.idleRingStrokeAlpha);
  const body = scene.add.rectangle(
    0,
    0,
    initialVisual.bodyWidth,
    initialVisual.bodyHeight,
    initialVisual.idleBodyColor,
    0.98,
  );
  body.setStrokeStyle(2, initialVisual.idleBodyStroke, 0.98);
  body.setInteractive({ useHandCursor: true });
  const core = scene.add.circle(
    0,
    initialVisual.coreOffsetY,
    initialVisual.coreRadius,
    initialVisual.idleCoreColor,
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

  // Core 0.23 -- real per-enemy HP/maxHp (already server-tracked and
  // already driving `getHpRatio` below) restyled with bdragon1727's
  // health-bar pack instead of a flat rectangle. One sprite, frame
  // selected by HP ratio -- see resolveHpBarFrame above.
  const hpBarSprite = scene.add.sprite(0, -31, ENEMY_HP_BAR_ASSET_ID, 0);
  hpBarSprite.setDisplaySize(HP_BAR_DISPLAY_WIDTH, HP_BAR_DISPLAY_HEIGHT);

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

  // Task 094 / Task 312 — telegraph warning marker and body glow.
  // A pulsing yellow triangle above the enemy shown during windup,
  // plus a body/ring tint that makes the enemy itself visually
  // "charge up" so incoming attacks are much easier to notice.
  // The marker is purely visual; the server still decides damage.
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

  // Task 312 — "INCOMING" label shown during windup for extra readability.
  const incomingLabel = scene.add
    .text(0, -42, "", {
      color: "#ffe8a0",
      fontFamily: "Arial, sans-serif",
      fontSize: "9px",
      fontStyle: "bold",
      stroke: "#2a1200",
      strokeThickness: 3,
      backgroundColor: "#6b2008",
      padding: { left: 3, right: 3, top: 1, bottom: 1 },
    })
    .setOrigin(0.5);
  incomingLabel.setVisible(false);

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
    hpBarSprite,
    hpText,
    labelText,
    stateText,
    telegraphMarker,
    telegraphExclaim,
    heavyTelegraphLabel,
    incomingLabel,
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
  let lastSpriteKey: string = initialSpriteKey;

  const applyEnemyVisualState = (nextEnemy: TownRoomEnemySnapshot): void => {
    const nextSpriteKey = resolveEnemySpriteKey(nextEnemy);
    const visual = resolveVariantVisual(nextSpriteKey);
    const hpRatio = getHpRatio(nextEnemy);
    hpBarSprite.setFrame(resolveHpBarFrame(hpRatio));

    if (nextSpriteKey !== lastSpriteKey) {
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
      lastSpriteKey = nextSpriteKey;
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
      labelText.setColor("#999999");
      labelText.setText(`${t(nextEnemy.label)} [${t("world_area.enemy_defeated_label")}]`);
      hpText.setColor("#b8b8b8");
      hpText.setText(
        t("world_area.enemy_respawning_in", {
          seconds: remainingSeconds,
        }),
      );
      hpBarSprite.setVisible(false);
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
    hpBarSprite.setVisible(true);
    shadow.setFillStyle(0x000000, 0.28);
    if (nextEnemy.state === "chasing") {
      // Universal chase glow, not type-tinted -- "this is hostile right
      // now" should read instantly regardless of which of the 12 real
      // enemy types this is; the idle colors below are what carry each
      // enemy's own real identity.
      ring.setFillStyle(0x6b0a0a, 0.55);
      ring.setStrokeStyle(3, 0xff3a1a, 0.95);
      body.setFillStyle(0xff2a1a, 1);
      body.setStrokeStyle(3, 0xffe066, 1);
      core.setFillStyle(0xfff0aa, 1);
      core.setScale(1.4);
      stateText.setColor("#ff3a1a");
      aggroExclaim.setVisible(true);
    } else if (nextEnemy.state === "returning") {
      ring.setFillStyle(0x2b466f, 0.3);
      ring.setStrokeStyle(2, 0x8ab8ff, 0.48);
      body.setFillStyle(0x426ca8, 0.95);
      body.setStrokeStyle(2, 0xbfd8ff, 0.95);
      stateText.setColor("#cfe0ff");
      aggroExclaim.setVisible(false);
      core.setScale(1);
    } else {
      ring.setFillStyle(visual.idleRingColor, visual.idleRingAlpha);
      ring.setStrokeStyle(2, visual.idleRingStroke, visual.idleRingStrokeAlpha);
      body.setFillStyle(visual.idleBodyColor, 0.95);
      body.setStrokeStyle(2, visual.idleBodyStroke, 0.95);
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
  // Task 312 — body/ring glow during windup. Saves original fill/stroke
  // and applies a warning tint so the enemy itself visually "charges
  // up", making incoming attacks much easier to notice.
  let telegraphGlowTween: Phaser.Tweens.Tween | null = null;
  let savedBodyFill: number = 0;
  let savedBodyFillAlpha: number = 1;
  let savedBodyStrokeColor: number = 0;
  let savedBodyStrokeAlpha: number = 1;
  let savedRingFill: number = 0;
  let savedRingFillAlpha: number = 1;
  let savedRingStrokeColor: number = 0;
  let savedRingStrokeAlpha: number = 1;

  const setTelegraphing = (active: boolean, attackKind: "normal" | "heavy" = "normal"): void => {
    const isHeavy = attackKind === "heavy";
    telegraphMarker.setFillStyle(isHeavy ? 0xff6a3d : 0xffe14a, 0.95);
    telegraphMarker.setStrokeStyle(2, isHeavy ? 0x5c1200 : 0x6b4a00, 0.9);
    telegraphExclaim.setText(isHeavy ? "!!" : "!");
    telegraphExclaim.setColor(isHeavy ? "#fff3e0" : "#1a0e00");
    telegraphMarker.setVisible(active);
    telegraphExclaim.setVisible(active);
    heavyTelegraphLabel.setVisible(active && isHeavy);

    // Task 312 — "INCOMING" label and body/ring glow.
    incomingLabel.setText(isHeavy ? "INCOMING!" : "INCOMING");
    incomingLabel.setColor(isHeavy ? "#ffccaa" : "#ffe8a0");
    incomingLabel.setBackgroundColor(isHeavy ? "#7a1008" : "#6b2008");
    incomingLabel.setVisible(active);

    if (active) {
      // Save original body/ring colors so we can restore them.
      savedBodyFill = body.fillColor ?? 0;
      savedBodyFillAlpha = body.alpha;
      savedBodyStrokeColor = body.strokeColor ?? 0;
      savedBodyStrokeAlpha = body.alpha;
      savedRingFill = ring.fillColor ?? 0;
      savedRingFillAlpha = ring.alpha;
      savedRingStrokeColor = ring.strokeColor ?? 0;
      savedRingStrokeAlpha = ring.alpha;

      // Apply warning tint to body: amber for normal, hot red for heavy.
      body.setFillStyle(isHeavy ? 0xff3a10 : 0xffaa22, 1);
      body.setStrokeStyle(3, isHeavy ? 0xff6644 : 0xffdd66, 1);
      // Apply glowing ring around the enemy.
      ring.setFillStyle(isHeavy ? 0x7a1008 : 0x6b4008, 0.65);
      ring.setStrokeStyle(3, isHeavy ? 0xff4422 : 0xffcc44, 0.95);

      // Pulsing marker tween.
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
      // Pulsing body/ring glow tween (single tween, no unbounded accumulation).
      if (telegraphGlowTween === null) {
        telegraphGlowTween = scene.tweens.add({
          targets: [body, ring],
          scaleX: { from: 1, to: 1.08 },
          scaleY: { from: 1, to: 1.08 },
          yoyo: true,
          duration: isHeavy ? 160 : 130,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      } else if (!telegraphGlowTween.isPlaying()) {
        telegraphGlowTween.restart();
      }
    } else {
      // Stop marker tween.
      if (telegraphTween !== null) {
        telegraphTween.stop();
        telegraphTween = null;
        telegraphMarker.setScale(1);
        telegraphExclaim.setScale(1);
        heavyTelegraphLabel.setScale(1);
        heavyTelegraphLabel.setVisible(false);
      }
      // Stop body/ring glow tween and restore original colors.
      if (telegraphGlowTween !== null) {
        telegraphGlowTween.stop();
        telegraphGlowTween = null;
      }
      body.setScale(1);
      ring.setScale(1);
      body.setFillStyle(savedBodyFill, savedBodyFillAlpha);
      body.setStrokeStyle(2, savedBodyStrokeColor, savedBodyStrokeAlpha);
      ring.setFillStyle(savedRingFill, savedRingFillAlpha);
      ring.setStrokeStyle(2, savedRingStrokeColor, savedRingStrokeAlpha);
      incomingLabel.setVisible(false);
    }
  };

  // Task 310 — brief hit flash. Preserves the current body fill/stroke
  // so the flash does not fight with chasing/returning/idle visual state.
  let flashTween: Phaser.Tweens.Tween | null = null;
  const flashHit = (): void => {
    if (body.fillColor === undefined) return;
    const originalFill = body.fillColor;
    const originalAlpha = body.alpha;
    body.setFillStyle(0xffffff, 1);
    if (flashTween !== null) {
      flashTween.stop();
    }
    flashTween = scene.tweens.add({
      targets: body,
      alpha: { from: 1, to: originalAlpha },
      duration: 120,
      onComplete: () => {
        body.setFillStyle(originalFill, originalAlpha);
        flashTween = null;
      },
    });
  };

  // Task 314 — hover highlight ring. A separate ellipse shown on top
  // of the existing ring when the player's cursor is over this enemy.
  // It does not interfere with chasing/returning/idle visual state.
  const hoverRing = scene.add.ellipse(
    0,
    initialVisual.ringOffsetY,
    initialVisual.ringWidth + 14,
    initialVisual.ringHeight + 10,
    0xffcc44,
    0.18,
  );
  hoverRing.setStrokeStyle(2, 0xffcc44, 0.7);
  hoverRing.setVisible(false);
  // Insert hoverRing before body so it appears between ring and body visually
  const hoverRingIndex = container.getIndex(body);
  container.addAt(hoverRing, hoverRingIndex);

  const setHovered = (hovered: boolean): void => {
    if (enemy.defeated) {
      hoverRing.setVisible(false);
      return;
    }
    hoverRing.setVisible(hovered);
  };

  applyEnemyVisualState(enemy);
  container.setDepth(400 + enemy.y);

  return {
    refresh,
    hide,
    setTelegraphing,
    flashHit,
    setHovered,
    destroy: () => {
      hoverRing.destroy();
      if (telegraphTween !== null) {
        telegraphTween.stop();
        telegraphTween = null;
      }
      if (telegraphGlowTween !== null) {
        telegraphGlowTween.stop();
        telegraphGlowTween = null;
      }
      if (flashTween !== null) {
        flashTween.stop();
        flashTween = null;
      }
      container.destroy(true);
    },
  };
}

