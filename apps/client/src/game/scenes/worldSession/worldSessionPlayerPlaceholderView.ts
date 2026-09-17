// Task 207 -- transient "Moving to loot / interact / attack"
// approach label shown above the player placeholder while the player
// is walking toward a queued deferred-action target. The label is
// driven from server-owned pendingActionType and is purely visual;
// the server still owns the action outcome.
export type ApproachActionLabel = "attack" | "interact" | "pickup" | null;

import Phaser from "phaser";
import { DEFAULT_PLAYER_TINT, type PlayerPlaceholderTint } from "./classTint";
import { PLAYER_SPRITE_ASSET_IDS } from "../../visualAssetLoader";
import { parseActiveStatusEffectTypes, type StatusEffectType } from "../../../net/statusEffects";

// Core 0.2 -- Status Effects & Debuff System. Same icon glyphs as the
// enemy placeholder view -- see worldSessionEnemyPlaceholderView.ts.
const STATUS_EFFECT_ICONS: Readonly<Record<StatusEffectType, string>> = {
  bleed: "🩸",
  slow: "🐌",
  stun: "💫",
  burn: "🔥",
  emp_dot: "⚡",
};

const HIDDEN_POSITION = -9999;

// Core 0.4x follow-up -- picks the sprite frame whose screen-facing octant
// best matches the direction the placeholder actually moved between the
// last two setPosition() calls. Order matches the 8 compass points at
// 45-degree steps starting from due "east" (angle 0), which is what
// Math.atan2(dy, dx) returns for a rightward-only screen delta.
const DIRECTION_ORDER = [
  PLAYER_SPRITE_ASSET_IDS.east,
  PLAYER_SPRITE_ASSET_IDS.south_east,
  PLAYER_SPRITE_ASSET_IDS.south,
  PLAYER_SPRITE_ASSET_IDS.south_west,
  PLAYER_SPRITE_ASSET_IDS.west,
  PLAYER_SPRITE_ASSET_IDS.north_west,
  PLAYER_SPRITE_ASSET_IDS.north,
  PLAYER_SPRITE_ASSET_IDS.north_east,
] as const;

// Below this many screen pixels of movement between frames, treat it as
// jitter/noise rather than an actual facing change (keeps the sprite
// stable while standing still instead of flickering between frames).
const MIN_FACING_MOVE_PX = 0.75;

// Above this many screen pixels, treat the jump as a teleport/show-hide
// snap (see HIDDEN_POSITION) rather than real movement, and skip the
// facing update entirely.
const MAX_FACING_MOVE_PX = 250;

function resolveDirectionAssetId(dx: number, dy: number): string {
  const angle = Math.atan2(dy, dx);
  const index = (Math.round(angle / (Math.PI / 4)) % 8 + 8) % 8;
  return DIRECTION_ORDER[index] ?? PLAYER_SPRITE_ASSET_IDS.south;
}

// Task 207 -- resolve the visible "Moving to ..." label text from
// the server-owned pendingActionType, or empty string to hide the
// label entirely. The server still owns the action; this is a pure
// presentation helper.
function getApproachLabelText(label: ApproachActionLabel): string {
  if (label === "attack") return "Moving to attack";
  if (label === "interact") return "Moving to interact";
  if (label === "pickup") return "Moving to loot";
  return "";
}

export interface WorldSessionPlayerPlaceholderView {
  readonly setPosition: (x: number, y: number) => void;
  // Core 0.4x -- scales the whole placeholder container so it grows/shrinks
  // with camera zoom the same way projected polygon geometry (buildings,
  // ground tiles) already does. 1 = the original fixed pixel size.
  readonly setScale: (scale: number) => void;
  // Core 0.4x follow-up -- separate scale for the name/HP label so it
  // keeps growing with camera zoom even though the body sprite is
  // deliberately shrunk by PLAYER_MARKER_BASE_SCALE (see caller). Without
  // this the label inherited the body's shrink and stayed too small to
  // read at high zoom.
  readonly setLabelScale: (scale: number) => void;
  readonly setInfo: (displayName?: string, hp?: number, maxHp?: number) => void;
  // Core 0.2 -- shows small icons above the player for currently active
  // status effects (bleed/slow/stun/burn). Purely visual; the server
  // remains the sole authority for what's actually active.
  readonly setStatusEffects: (raw: string | undefined) => void;
  readonly setMarkerDirection: (angle: number) => void;
  // Task 207 -- small visual hint that the player is currently
  // walking toward a queued deferred-action target. Pass `null` to
  // clear the label.
  readonly setApproachLabel: (label: ApproachActionLabel) => void;
  // Task 311 — brief red flash on the player body when server-confirmed
  // damage lands. Purely visual; preserves the original fill after tween.
  readonly flashDamage: () => void;
  readonly hide: () => void;
  readonly destroy: () => void;
}

export function createWorldSessionPlayerPlaceholderView(
  scene: Phaser.Scene,
  parentContainer?: Phaser.GameObjects.Container,
  tint: PlayerPlaceholderTint = DEFAULT_PLAYER_TINT,
): WorldSessionPlayerPlaceholderView {
  const container = scene.add.container(HIDDEN_POSITION, HIDDEN_POSITION);
  container.setDepth(500);
  parentContainer?.add(container);

  const shadow = scene.add.ellipse(0, 13, 28, 14, 0x000000, 0.28);
  const ring = scene.add.ellipse(0, 10, 34, 18, 0x12304d, 0.28);
  ring.setStrokeStyle(2, tint.ringStrokeColor, 0.55);

  // Core 0.4x follow-up -- replaces the drawn legs/torso/shoulders/head
  // primitives with the real sewer-dweller-male placeholder sprite. The
  // texture is swapped between the 8 pre-loaded direction frames as the
  // placeholder moves (see setPosition below); still a placeholder pack,
  // but real pixel art instead of vector shapes.
  const body = scene.add.image(0, -1, PLAYER_SPRITE_ASSET_IDS.south);
  body.setDisplaySize(44, 44);

  // Task 207's approach-label / marker triangle doubled as a "which way
  // am I facing" hint back when the body was a faceless blob; now the
  // sprite itself shows facing, so this is kept only as the small
  // floating compass arrow toward the current click-move target, moved
  // clear of the head.
  const marker = scene.add.triangle(0, -32, 0, 0, 10, 0, 5, -10, 0xd6c29d, 1);
  marker.setStrokeStyle(1, 0x2b241c, 0.9);

  // Task 207 -- short label rendered just under the player
  // placeholder while the player is walking toward a queued
  // deferred-action target (attack / interact / pickup). The label
  // is purely visual; the server still owns the action outcome and
  // the client only reads `pendingActionType` for display.
  const approachLabelText = scene.add
    .text(0, 22, "", {
      color: "#ffe6a8",
      fontFamily: "Arial, sans-serif",
      fontSize: "9px",
      fontStyle: "bold",
      stroke: "#1a1206",
      strokeThickness: 3,
      align: "center",
      backgroundColor: "rgba(20, 12, 4, 0.85)",
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    })
    .setOrigin(0.5)
    .setVisible(false);

  // Task 311 — brief red tint overlay for damage flash. Added on top of
  // the body sprite so flashDamage() can tween it without touching the
  // sprite texture/state used by normal facing updates.
  const damageFlashOverlay = scene.add.ellipse(0, -1, 24, 28, 0xff2222, 0);
  damageFlashOverlay.setDepth(1);

  const core = scene.add.circle(0, -2, 4, 0xffffff, 0.45);
  const infoText = scene.add
    .text(0, -34, "", {
      color: "#dff3ff",
      fontFamily: "Arial, sans-serif",
      fontSize: "9px",
      fontStyle: "bold",
      stroke: "#102030",
      strokeThickness: 3,
      align: "center",
    })
    .setOrigin(0.5)
    .setVisible(false);

  // Core 0.2 -- status effect icon row, shown just above the name/HP label.
  const statusEffectsText = scene.add
    .text(0, -46, "", {
      fontSize: "12px",
    })
    .setOrigin(0.5)
    .setVisible(false);

  container.add([shadow, ring, body, marker, damageFlashOverlay, core]);

  // Core 0.4x follow-up -- name/HP label and the approach-action label
  // live in their own container so they can be scaled independently of
  // the body (see setLabelScale). Kept as a sibling of `container` (not
  // nested inside it) so its scale isn't compounded with the body's
  // PLAYER_MARKER_BASE_SCALE shrink.
  const labelContainer = scene.add.container(HIDDEN_POSITION, HIDDEN_POSITION);
  labelContainer.setDepth(501);
  parentContainer?.add(labelContainer);
  labelContainer.add([infoText, approachLabelText, statusEffectsText]);

  const setInfo = (displayName?: string, hp?: number, maxHp?: number): void => {
    const safeName = typeof displayName === "string" ? displayName.trim() : "";
    const hasHp = typeof hp === "number" && Number.isFinite(hp) && typeof maxHp === "number" && Number.isFinite(maxHp) && maxHp > 0;

    if (safeName.length === 0 && !hasHp) {
      infoText.setVisible(false);
      infoText.setText("");
      return;
    }

    const nameLine = safeName.length > 14 ? `${safeName.slice(0, 14)}…` : safeName;
    const hpLine = hasHp ? `${Math.max(0, Math.round(hp))}/${Math.max(0, Math.round(maxHp))}` : "";
    const nextText = nameLine.length > 0 && hpLine.length > 0
      ? `${nameLine}\n${hpLine}`
      : nameLine.length > 0
        ? nameLine
        : hpLine;

    infoText.setText(nextText);
    infoText.setVisible(nextText.length > 0);
  };

  const hide = (): void => {
    container.setPosition(HIDDEN_POSITION, HIDDEN_POSITION);
    labelContainer.setPosition(HIDDEN_POSITION, HIDDEN_POSITION);
  };

  // Task 311 — brief red flash on the player body when server-confirmed
  // damage lands. Tweens a red overlay alpha up then back to zero so
  // the base torso fill/stroke are never modified (preserves the
  // chasing/returning/idle visual state pattern used by enemies).
  let damageFlashTween: Phaser.Tweens.Tween | null = null;
  const flashDamage = (): void => {
    damageFlashOverlay.setAlpha(0.65);
    if (damageFlashTween !== null) {
      damageFlashTween.stop();
    }
    damageFlashTween = scene.tweens.add({
      targets: damageFlashOverlay,
      alpha: { from: 0.65, to: 0 },
      duration: 220,
      ease: "Cubic.easeOut",
      onComplete: () => {
        damageFlashOverlay.setAlpha(0);
        damageFlashTween = null;
      },
    });
  };

  let lastFacingX: number | null = null;
  let lastFacingY: number | null = null;

  return {
    setPosition: (x: number, y: number) => {
      container.setPosition(x, y);
      container.setDepth(500 + y);
      labelContainer.setPosition(x, y);
      labelContainer.setDepth(501 + y);

      if (lastFacingX !== null && lastFacingY !== null) {
        const dx = x - lastFacingX;
        const dy = y - lastFacingY;
        const distance = Math.hypot(dx, dy);
        if (distance >= MIN_FACING_MOVE_PX && distance <= MAX_FACING_MOVE_PX) {
          body.setTexture(resolveDirectionAssetId(dx, dy));
        }
      }
      lastFacingX = x;
      lastFacingY = y;
    },
    setScale: (scale: number) => {
      container.setScale(Number.isFinite(scale) && scale > 0 ? scale : 1);
    },
    setLabelScale: (scale: number) => {
      labelContainer.setScale(Number.isFinite(scale) && scale > 0 ? scale : 1);
    },
    setInfo,
    setStatusEffects: (raw: string | undefined) => {
      const activeTypes = parseActiveStatusEffectTypes(raw, Date.now());
      statusEffectsText.setText(activeTypes.map((type) => STATUS_EFFECT_ICONS[type]).join(" "));
      statusEffectsText.setVisible(activeTypes.length > 0);
    },
    setMarkerDirection: (angle: number) => {
      marker.setRotation(angle);
    },
    setApproachLabel: (label: ApproachActionLabel) => {
      const nextText = getApproachLabelText(label);
      approachLabelText.setText(nextText);
      approachLabelText.setVisible(nextText.length > 0);
    },
    flashDamage,
    hide,
    destroy: () => {
      if (damageFlashTween !== null) {
        damageFlashTween.stop();
        damageFlashTween = null;
      }
      container.destroy(true);
      labelContainer.destroy(true);
    },
  };
}
