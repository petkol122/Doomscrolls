import Phaser from "phaser";

export interface WorldSessionAreaLayout {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

const SCREEN_MARGIN_LEFT = 24;
const SCREEN_MARGIN_RIGHT = 24;
const SCREEN_MARGIN_TOP = 24;
const SCREEN_MARGIN_BOTTOM = 24;
const CHARACTER_CHIP_RESERVED_WIDTH = 220;
const CHARACTER_CHIP_RESERVED_HEIGHT = 72;
const CHARACTER_CHIP_GAP = 16;
const UTILITY_PANEL_WIDTH = 300;
const UTILITY_PANEL_GAP = 20;
const BOTTOM_HUD_HEIGHT = 170;
const BOTTOM_HUD_GAP = 20;
const MIN_AREA_WIDTH = 720;
const MIN_AREA_HEIGHT = 420;

export function resolveWorldSessionAreaLayout(scene: Phaser.Scene): WorldSessionAreaLayout {
  const leftBoundary = SCREEN_MARGIN_LEFT + CHARACTER_CHIP_RESERVED_WIDTH + CHARACTER_CHIP_GAP;
  const rightBoundary = scene.scale.width - SCREEN_MARGIN_RIGHT - UTILITY_PANEL_WIDTH - UTILITY_PANEL_GAP;
  const topBoundary = SCREEN_MARGIN_TOP + CHARACTER_CHIP_RESERVED_HEIGHT + CHARACTER_CHIP_GAP;
  const bottomBoundary = scene.scale.height - SCREEN_MARGIN_BOTTOM - BOTTOM_HUD_HEIGHT - BOTTOM_HUD_GAP;

  const availableWidth = Math.max(MIN_AREA_WIDTH, rightBoundary - leftBoundary);
  const availableHeight = Math.max(MIN_AREA_HEIGHT, bottomBoundary - topBoundary);
  const centeredOriginX = leftBoundary + Math.max(0, (rightBoundary - leftBoundary - availableWidth) / 2);
  const centeredOriginY = topBoundary + Math.max(0, (bottomBoundary - topBoundary - availableHeight) / 2);

  return {
    originX: centeredOriginX,
    originY: centeredOriginY,
    width: availableWidth,
    height: availableHeight,
  };
}
