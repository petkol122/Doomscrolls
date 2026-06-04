import Phaser from "phaser";

export interface FloatingDamageNumberView {
  readonly show: (x: number, y: number, text: string) => void;
  readonly destroy: () => void;
}

const LIFETIME_MS = 600;

export function createFloatingDamageNumberView(scene: Phaser.Scene): FloatingDamageNumberView {
  const active = new Set<Phaser.GameObjects.Text>();
  const timers = new WeakMap<Phaser.GameObjects.Text, Phaser.Time.TimerEvent>();

  const destroyText = (text: Phaser.GameObjects.Text): void => {
    const timer = timers.get(text);
    if (timer !== undefined) {
      timer.remove(false);
      timers.delete(text);
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
      active.add(node);
      const timer = scene.time.delayedCall(LIFETIME_MS, () => {
        destroyText(node);
      });
      timers.set(node, timer);
    },
    destroy: () => {
      for (const text of Array.from(active)) {
        destroyText(text);
      }
    },
  };
}
