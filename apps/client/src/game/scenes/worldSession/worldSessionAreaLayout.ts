import Phaser from "phaser";

export interface WorldSessionAreaLayout {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

const SCREEN_MARGIN_LEFT = 20;
const SCREEN_MARGIN_RIGHT = 20;
const SCREEN_MARGIN_TOP = 32;
const SCREEN_MARGIN_BOTTOM = 24;
const MIN_AREA_WIDTH = 960;
const MIN_AREA_HEIGHT = 560;

export function resolveWorldSessionAreaLayout(scene: Phaser.Scene): WorldSessionAreaLayout {
  const availableWidth = Math.max(0, scene.scale.width - SCREEN_MARGIN_LEFT - SCREEN_MARGIN_RIGHT);
  const availableHeight = Math.max(0, scene.scale.height - SCREEN_MARGIN_TOP - SCREEN_MARGIN_BOTTOM);
  const resolvedWidth = Math.max(MIN_AREA_WIDTH, availableWidth);
  const resolvedHeight = Math.max(MIN_AREA_HEIGHT, availableHeight);
  const centeredOriginX = (scene.scale.width - resolvedWidth) / 2;
  const centeredOriginY = (scene.scale.height - resolvedHeight) / 2;

  return {
    originX: centeredOriginX,
    originY: centeredOriginY,
    width: resolvedWidth,
    height: resolvedHeight,
  };
}
