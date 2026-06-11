import Phaser from "phaser";

export interface FloatingDamageNumberView {
  readonly show: (x: number, y: number, text: string) => void;
  readonly destroy: () => void;
}

// Task 310 — float-up duration and travel distance for damage numbers.
const LIFETIME_MS = 700;
const FLOAT_UP_Y = -22;

export function createFloatingDamageNumberView(
  scene: Phaser.Scene,
  parentContainer?: Phaser.GameObjects.Container,
): FloatingDamageNumberView {
  const active = new Set<Phaser.GameObjects.Text>();
  const tweens = new WeakMap<Phaser.GameObjects.Text, Phaser.Tweens.Tween>();

  const destroyText = (text: Phaser.GameObjects.Text): void => {
    const tw = tweens.get(text);
    if (tw !== undefined) {
      tw.stop();
      tweens.delete(text);
    }
    active.delete(text);
    text.destroy();
  };

  return {
    show: (x: number, y: number, text: string) => {
      const node = scene.add.text(x, y, text, {
        color: "#ffe27a",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        stroke: "#160909",
        strokeThickness: 3,
      });
      node.setOrigin(0.5, 0.5);
      node.setDepth(950);
      parentContainer?.add(node);
      active.add(node);

      // Task 310 — float-up + fade so damage numbers read as hits.
      const tw = scene.tweens.add({
        targets: node,
        y: y + FLOAT_UP_Y,
        alpha: { from: 1, to: 0 },
        duration: LIFETIME_MS,
        ease: "Cubic.easeOut",
        onComplete: () => {
          tweens.delete(node);
          active.delete(node);
          node.destroy();
        },
      });
      tweens.set(node, tw);
    },
    destroy: () => {
      for (const text of Array.from(active)) {
        destroyText(text);
      }
    },
  };
}
