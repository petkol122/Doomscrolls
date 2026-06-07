import Phaser from "phaser";

const HIDDEN_POSITION = -9999;

export interface WorldSessionPlayerPlaceholderView {
  readonly setPosition: (x: number, y: number) => void;
  readonly setInfo: (displayName?: string, hp?: number, maxHp?: number) => void;
  readonly setMarkerDirection: (angle: number) => void;
  readonly hide: () => void;
  readonly destroy: () => void;
}

export function createWorldSessionPlayerPlaceholderView(
  scene: Phaser.Scene,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionPlayerPlaceholderView {
  const container = scene.add.container(HIDDEN_POSITION, HIDDEN_POSITION);
  container.setDepth(500);
  parentContainer?.add(container);

  const shadow = scene.add.ellipse(0, 13, 28, 14, 0x000000, 0.28);
  const ring = scene.add.ellipse(0, 10, 34, 18, 0x12304d, 0.28);
  ring.setStrokeStyle(2, 0x8fd4ff, 0.55);

  const legs = scene.add.triangle(0, 10, -8, 0, 8, 0, 0, 12, 0x2f6fb5, 0.98);
  legs.setStrokeStyle(2, 0xb8e4ff, 0.8);

  const torso = scene.add.ellipse(0, -1, 22, 26, 0x4a9eff, 1);
  torso.setStrokeStyle(2, 0xd8ecff, 0.95);

  const shoulders = scene.add.rectangle(0, -2, 28, 7, 0x78bbff, 0.95);
  shoulders.setStrokeStyle(1, 0xe5f4ff, 0.7);

  const head = scene.add.circle(0, -15, 6, 0xf3efe5, 0.95);
  head.setStrokeStyle(2, 0xd8ecff, 0.7);

  const marker = scene.add.triangle(0, -14, 0, 0, 10, 0, 5, -10, 0xd6c29d, 1);
  marker.setStrokeStyle(1, 0x2b241c, 0.9);

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

  container.add([shadow, ring, legs, torso, shoulders, marker, head, core, infoText]);

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
  };

  return {
    setPosition: (x: number, y: number) => {
      container.setPosition(x, y);
      container.setDepth(500 + y);
    },
    setInfo,
    setMarkerDirection: (angle: number) => {
      marker.setRotation(angle);
    },
    hide,
    destroy: () => {
      container.destroy(true);
    },
  };
}