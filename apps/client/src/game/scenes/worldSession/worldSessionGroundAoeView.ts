import Phaser from "phaser";

import type { TownRoomGroundEffectSnapshot } from "../../../net/townRoomGroundEffects";

// Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
// Skills. Purely cosmetic marker for a ground_aoe cast: a circle at the
// synced radius that fades out over its spawnedAtMs -> expiresAtMs
// window, following `floatingDamageNumberView.ts`'s self-contained tween
// style. The server resolves the actual AoE hit instantly at cast time;
// this view has no gameplay authority of its own.
const GROUND_AOE_FILL = 0xff6a3d;
const GROUND_AOE_STROKE = 0xffe14a;

export interface WorldSessionGroundAoeView {
  readonly update: (snapshot: TownRoomGroundEffectSnapshot) => void;
  readonly isExpired: (now: number) => boolean;
  readonly destroy: () => void;
}

export function createWorldSessionGroundAoeView(
  scene: Phaser.Scene,
  snapshot: TownRoomGroundEffectSnapshot,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionGroundAoeView {
  const circle = scene.add.circle(snapshot.x, snapshot.y, snapshot.radius, GROUND_AOE_FILL, 0.28);
  circle.setStrokeStyle(3, GROUND_AOE_STROKE, 0.85);
  circle.setDepth(210);
  parentContainer?.add(circle);

  let expiresAtMs = snapshot.expiresAtMs;
  const tween = scene.tweens.add({
    targets: circle,
    alpha: { from: 0.85, to: 0 },
    duration: Math.max(0, snapshot.expiresAtMs - snapshot.spawnedAtMs),
    ease: "Cubic.easeOut",
  });

  return {
    update: (nextSnapshot: TownRoomGroundEffectSnapshot) => {
      circle.setPosition(nextSnapshot.x, nextSnapshot.y);
      circle.setRadius(nextSnapshot.radius);
      expiresAtMs = nextSnapshot.expiresAtMs;
    },
    isExpired: (now: number) => now >= expiresAtMs,
    destroy: () => {
      tween.stop();
      circle.destroy();
    },
  };
}
