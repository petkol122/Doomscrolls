import Phaser from "phaser";

export interface WorldSessionAreaLayout {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

const AREA_MARGIN_LEFT = 20;
const AREA_MARGIN_RIGHT = 20;
const AREA_MARGIN_TOP = 56;
const AREA_MARGIN_BOTTOM = 24;
const OVERLAY_SIDEBAR_WIDTH = 300;
const OVERLAY_SIDEBAR_GAP = 16;
const MIN_AREA_WIDTH = 640;
const MIN_AREA_HEIGHT = 360;

export function resolveWorldSessionAreaLayout(scene: Phaser.Scene): WorldSessionAreaLayout {
  const availableWidth = scene.scale.width
    - AREA_MARGIN_LEFT
    - AREA_MARGIN_RIGHT
    - OVERLAY_SIDEBAR_WIDTH
    - OVERLAY_SIDEBAR_GAP;
  const width = Math.max(MIN_AREA_WIDTH, availableWidth);
  const height = Math.max(MIN_AREA_HEIGHT, scene.scale.height - AREA_MARGIN_TOP - AREA_MARGIN_BOTTOM);

  return {
    originX: AREA_MARGIN_LEFT,
    originY: AREA_MARGIN_TOP,
    width,
    height,
  };
}
