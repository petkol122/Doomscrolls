import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { TownRoomWorldLootSnapshot } from "../../../net/townRoomWorldLoot";
import { getItemRarityColor as resolveItemRarityColor, getItemRarityAccentColor } from "../../itemRarityColors";
import {
  ensureLootFilterAltListenerAttached,
  isLootFilterOverrideActive,
  isLootRarityVisible,
  subscribeLootFilterState,
} from "./worldSessionLootFilterState";

/** Milestone 0.3 -- prefer the per-instance rolled tier (see
 *  affixRollEngine.ts) over the item template's fixed rarity, when set. */
function resolveDisplayRarity(loot: TownRoomWorldLootSnapshot): string | undefined {
  return loot.rarityTier !== undefined && loot.rarityTier.length > 0 ? loot.rarityTier : loot.rarity;
}

const COMMON_LOOT_COLOR = "#ffe7a8";
const COMMON_LOOT_STROKE = "#221606";
const CURRENCY_LOOT_COLOR = "#f0c674";
const CURRENCY_LOOT_STROKE = "#1d1206";
const LOOT_FONT_SIZE = "14px";
const LOOT_LABEL_BG_COLOR = 0x0a0a0a;
const LOOT_LABEL_BG_ALPHA = 0.88;
const LOOT_LABEL_BG_PADDING = 10;
const LOOT_LABEL_BG_HEIGHT = 19;
const CURRENCY_LOOT_BODY_FILL = 0xd4a25a;
const CURRENCY_LOOT_BODY_STROKE = 0xffd58a;
const CURRENCY_LOOT_GLOW = 0xf0c674;
const CURRENCY_LOOT_PING = 0xffd58a;
const CURRENCY_LOOT_PING_STROKE = 0xffe7b3;

// Deterministic scatter offset per loot id so items at the same world
// position spread apart visually. Range ±12px on each axis.
const SCATTER_RANGE = 12;

function hashLootId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return h;
}

export function getScatterOffset(id: string): { readonly x: number; readonly y: number } {
  const h = hashLootId(id);
  return {
    x: (h % (SCATTER_RANGE * 2 + 1)) - SCATTER_RANGE,
    y: ((h >> 8) % (SCATTER_RANGE * 2 + 1)) - SCATTER_RANGE,
  };
}

function getItemRarityColor(rarity?: string): string {
  if (rarity === undefined || rarity.length === 0 || rarity === "common" || rarity === "normal") {
    return COMMON_LOOT_COLOR;
  }
  return resolveItemRarityColor(rarity);
}

function getItemRarityStrokeColor(rarity?: string): string {
  if (rarity === undefined || rarity.length === 0 || rarity === "common" || rarity === "normal") {
    return COMMON_LOOT_STROKE;
  }
  return getItemRarityAccentColor(rarity);
}

function getLootPlaceholderPalette(loot: TownRoomWorldLootSnapshot): {
  readonly glow: number;
  readonly ping: number;
  readonly pingStroke: number;
  readonly body: number;
  readonly bodyStroke: number;
} {
  if (loot.currencyCopper > 0) {
    return {
      glow: CURRENCY_LOOT_GLOW,
      ping: CURRENCY_LOOT_PING,
      pingStroke: CURRENCY_LOOT_PING_STROKE,
      body: CURRENCY_LOOT_BODY_FILL,
      bodyStroke: CURRENCY_LOOT_BODY_STROKE,
    };
  }

  const displayRarity = resolveDisplayRarity(loot);

  if (displayRarity === "legendary") {
    return {
      glow: 0xff8c3d,
      ping: 0xffb066,
      pingStroke: 0xffe4c2,
      body: 0xc96a1f,
      bodyStroke: 0xffe4c2,
    };
  }

  if (displayRarity === "epic") {
    return {
      glow: 0xa855f7,
      ping: 0xc77dff,
      pingStroke: 0xefd9ff,
      body: 0x8b3fd6,
      bodyStroke: 0xefd9ff,
    };
  }

  if (displayRarity === "rare") {
    return {
      glow: 0x66b7ff,
      ping: 0x9bd2ff,
      pingStroke: 0xd7efff,
      body: 0x4b86d8,
      bodyStroke: 0xe0f2ff,
    };
  }

  if (displayRarity === "magic") {
    return {
      glow: 0x4a90ff,
      ping: 0x7fb0ff,
      pingStroke: 0xd0e4ff,
      body: 0x2f5fbf,
      bodyStroke: 0xd0e4ff,
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

function isCurrencyLoot(loot: TownRoomWorldLootSnapshot): boolean {
  return loot.currencyCopper > 0;
}

// Milestone 0.3 -- Visual Drop Beams. Only the top two tiers get a beam
// (matches the classic White/Blue/Yellow/Orange ladder from
// itemRarityColors.ts -- a beam on every colored drop would just be noise).
const BEAM_RARITIES = new Set(["rare", "legendary"]);
const BEAM_HEIGHT = 68;
const BEAM_WIDTH = 7;
const BEAM_TOP_Y = -(BEAM_HEIGHT + 4);

function hexColorStringToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function shouldShowDropBeam(loot: TownRoomWorldLootSnapshot): boolean {
  if (isCurrencyLoot(loot)) {
    return false;
  }
  const rarity = resolveDisplayRarity(loot);
  return rarity !== undefined && BEAM_RARITIES.has(rarity);
}

function getDropBeamColor(loot: TownRoomWorldLootSnapshot): number {
  return hexColorStringToNumber(getItemRarityColor(resolveDisplayRarity(loot)));
}

function drawDropBeam(beam: Phaser.GameObjects.Graphics, color: number): void {
  beam.clear();
  beam.fillGradientStyle(color, color, color, color, 0.05, 0.05, 0.55, 0.55);
  beam.fillRect(-BEAM_WIDTH / 2, BEAM_TOP_Y, BEAM_WIDTH, BEAM_HEIGHT);
}

function getCurrencyLabel(loot: TownRoomWorldLootSnapshot): string {
  const amount = Math.max(1, Math.floor(loot.currencyCopper));
  // Compact "3c" label for the in-world placeholder, alongside the
  // longer "Copper x3" form for readability. Pickup feedback still uses
  // the shared `formatMoneyCompact` path elsewhere.
  return `${amount}c`;
}

function getLootLabelText(loot: TownRoomWorldLootSnapshot): string {
  if (isCurrencyLoot(loot)) {
    return getCurrencyLabel(loot);
  }
  return t(loot.label);
}

function getLootLabelColor(loot: TownRoomWorldLootSnapshot): string {
  if (isCurrencyLoot(loot)) {
    return CURRENCY_LOOT_COLOR;
  }
  return getItemRarityColor(resolveDisplayRarity(loot));
}

function getLootLabelStrokeColor(loot: TownRoomWorldLootSnapshot): string {
  if (isCurrencyLoot(loot)) {
    return CURRENCY_LOOT_STROKE;
  }
  return getItemRarityStrokeColor(resolveDisplayRarity(loot));
}

export interface WorldSessionLootPlaceholderView {
  readonly refresh: (loot: TownRoomWorldLootSnapshot, isPendingTarget?: boolean) => void;
  // Task 314 — show/hide hover highlight ring around this loot item.
  readonly setHovered: (hovered: boolean) => void;
  readonly destroy: () => void;
}

export function createWorldSessionLootPlaceholderView(
  scene: Phaser.Scene,
  loot: TownRoomWorldLootSnapshot,
  parentContainer?: Phaser.GameObjects.Container,
  onClick?: (worldLootId: string) => void,
): WorldSessionLootPlaceholderView {
  ensureLootFilterAltListenerAttached();

  const initialPalette = getLootPlaceholderPalette(loot);
  const scatter = getScatterOffset(loot.id);
  const container = scene.add.container(loot.x + scatter.x, loot.y + scatter.y);
  container.setDepth(300 + loot.y);
  parentContainer?.add(container);

  // Milestone 0.3 -- Visual Drop Beam, drawn beneath everything else in the
  // container so the body/label still read on top of it.
  const beam = scene.add.graphics();
  const beamTween = scene.tweens.add({
    targets: beam,
    alpha: { from: 0.55, to: 1 },
    duration: 950,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  const applyBeamState = (currentLoot: TownRoomWorldLootSnapshot): void => {
    const showBeam = shouldShowDropBeam(currentLoot);
    beam.setVisible(showBeam);
    if (showBeam) {
      drawDropBeam(beam, getDropBeamColor(currentLoot));
    }
  };
  applyBeamState(loot);

  const glow = scene.add.ellipse(0, 10, 28, 13, initialPalette.glow, 0.32);
  const ping = scene.add.ellipse(0, 9, 36, 15, initialPalette.ping, 0.15);
  ping.setStrokeStyle(2, initialPalette.pingStroke, 0.3);
  const body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse = isCurrencyLoot(loot)
    ? scene.add.ellipse(0, 0, 20, 20, initialPalette.body, 0.98)
    : scene.add.rectangle(0, 0, 20, 20, initialPalette.body, 0.98);
  body.setStrokeStyle(2, initialPalette.bodyStroke, 0.98);
  body.setInteractive({ useHandCursor: true });
  const targetRing = scene.add.ellipse(0, 0, 32, 32);
  targetRing.setStrokeStyle(2, 0xfbf2a2, 0);
  const labelBg = scene.add.rectangle(0, 18, 0, LOOT_LABEL_BG_HEIGHT, LOOT_LABEL_BG_COLOR, LOOT_LABEL_BG_ALPHA);
  labelBg.setStrokeStyle(1, 0x5a5a5a, 0.7);
  const labelText = scene.add
    .text(0, 17, getLootLabelText(loot), {
      color: getLootLabelColor(loot),
      fontFamily: "Arial, sans-serif",
      fontSize: LOOT_FONT_SIZE,
      stroke: getLootLabelStrokeColor(loot),
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  // Size label background to fit text
  const labelBounds = labelText.getBounds();
  labelBg.setSize(labelBounds.width + LOOT_LABEL_BG_PADDING, LOOT_LABEL_BG_HEIGHT);

  body.on(Phaser.Input.Events.POINTER_DOWN, () => {
    onClick?.(loot.id);
  });

  container.add([beam, glow, ping, targetRing, body, labelBg, labelText]);

  // Task 314 — hover highlight ring. Separate from the existing targetRing
  // (which is used for pending pickup state). Shown when the player's cursor
  // is over this loot item.
  const hoverRing = scene.add.ellipse(0, 0, 36, 36);
  hoverRing.setStrokeStyle(2, 0xffe7a8, 0);
  container.addAt(hoverRing, container.getIndex(body));

  const setHovered = (hovered: boolean): void => {
    if (hovered) {
      hoverRing.setStrokeStyle(2, 0xffe7a8, 0.65);
      hoverRing.setVisible(true);
    } else {
      hoverRing.setStrokeStyle(2, 0xffe7a8, 0);
      hoverRing.setVisible(false);
    }
  };

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

  // Milestone 0.3 -- Client Loot Filter. `latestLoot` lets the filter
  // subscription (which fires on Alt press/release and rule toggles, not
  // just on the next `refresh()` from a room state tick) re-evaluate this
  // item's visibility against whatever loot it most recently rendered.
  let latestLoot = loot;
  const applyFilterVisibility = (): void => {
    const rarity = isCurrencyLoot(latestLoot) ? undefined : resolveDisplayRarity(latestLoot);
    const passesFilter = isCurrencyLoot(latestLoot) || isLootRarityVisible(rarity);
    const overrideActive = isLootFilterOverrideActive();
    container.setVisible(passesFilter || overrideActive);
    // Items only visible because of the Alt override render dimmed, so
    // players can tell "filtered but revealed" apart from "actually shown".
    container.setAlpha(passesFilter ? 1 : 0.55);
  };
  applyFilterVisibility();
  const unsubscribeFilterState = subscribeLootFilterState(applyFilterVisibility);

  return {
    setHovered,
    refresh: (nextLoot: TownRoomWorldLootSnapshot, isPendingTarget = false) => {
      latestLoot = nextLoot;
      const nextScatter = getScatterOffset(nextLoot.id);
    container.setPosition(nextLoot.x + nextScatter.x, nextLoot.y + nextScatter.y);
    container.setDepth(300 + nextLoot.y);
      applyBeamState(nextLoot);
      applyFilterVisibility();
      labelText.setText(getLootLabelText(nextLoot));
      labelText.setColor(getLootLabelColor(nextLoot));
      labelText.setStroke(getLootLabelStrokeColor(nextLoot), 3);
      const nextLabelBounds = labelText.getBounds();
      labelBg.setSize(nextLabelBounds.width + LOOT_LABEL_BG_PADDING, LOOT_LABEL_BG_HEIGHT);
      const palette = getLootPlaceholderPalette(nextLoot);
      glow.setFillStyle(palette.glow, 0.26);
      ping.setFillStyle(palette.ping, 0.12);
      ping.setStrokeStyle(2, palette.pingStroke, 0.3);
      body.setFillStyle(palette.body, 0.98);
      body.setStrokeStyle(2, palette.bodyStroke, 0.98);
      applyPendingTargetState(isPendingTarget);
    },
    destroy: () => {
      unsubscribeFilterState();
      beamTween.stop();
      container.destroy(true);
    },
  };
}
