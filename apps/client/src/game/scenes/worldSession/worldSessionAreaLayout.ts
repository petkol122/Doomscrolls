import Phaser from "phaser";

export interface WorldSessionAreaLayout {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

const AREA_MARGIN_X = 84;
const AREA_MARGIN_TOP = 120;
const AREA_MARGIN_BOTTOM = 132;
const MIN_AREA_WIDTH = 840;
const MIN_AREA_HEIGHT = 420;

export function resolveWorldSessionAreaLayout(scene: Phaser.Scene): WorldSessionAreaLayout {
  const width = Math.max(MIN_AREA_WIDTH, scene.scale.width - AREA_MARGIN_X * 2);
  const height = Math.max(MIN_AREA_HEIGHT, scene.scale.height - AREA_MARGIN_TOP - AREA_MARGIN_BOTTOM);

  return {
    originX: Math.max(AREA_MARGIN_X, (scene.scale.width - width) / 2),
    originY: AREA_MARGIN_TOP,
    width,
    height,
  };
}
