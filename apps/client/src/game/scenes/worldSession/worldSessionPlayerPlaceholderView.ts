import Phaser from "phaser";

const HIDDEN_POSITION = -9999;

export interface WorldSessionPlayerPlaceholderView {
  readonly setPosition: (x: number, y: number) => void;
  readonly setMarkerDirection: (angle: number) => void;
  readonly hide: () => void;
  readonly destroy: () => void;
}

export function createWorldSessionPlayerPlaceholderView(
  scene: Phaser.Scene,
): WorldSessionPlayerPlaceholderView {
  const container = scene.add.container(HIDDEN_POSITION, HIDDEN_POSITION);

  const shadow = scene.add.ellipse(0, 10, 24, 12, 0x000000, 0.28);
  const body = scene.add.circle(0, 0, 12, 0x4a9eff, 1);
  body.setStrokeStyle(2, 0xd8ecff, 0.95);

  const marker = scene.add.triangle(0, -14, 0, 0, 10, 0, 5, -10, 0xd6c29d, 1);
  marker.setStrokeStyle(1, 0x2b241c, 0.9);

  const core = scene.add.circle(0, -2, 4, 0xf3efe5, 0.85);

  container.add([shadow, body, marker, core]);

  const hide = (): void => {
    container.setPosition(HIDDEN_POSITION, HIDDEN_POSITION);
  };

  return {
    setPosition: (x: number, y: number) => {
      container.setPosition(x, y);
    },
    setMarkerDirection: (angle: number) => {
      marker.setRotation(angle);
    },
    hide,
    destroy: () => {
      container.destroy(true);
    },
  };
}