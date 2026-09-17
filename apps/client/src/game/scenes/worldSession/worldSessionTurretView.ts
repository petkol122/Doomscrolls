import Phaser from "phaser";

import type { TownRoomTurretSnapshot } from "../../../net/townRoomTurrets";

/**
 * Milestone 0.3 -- Netrunner Urban-Magic Class Archetype. Ground marker for
 * an active `overclock_turret`: a blue/cyan techwear ring at the turret's
 * fixed position plus a faint attack-range outline, both persisting for
 * the turret's full lifespan (unlike `worldSessionGroundAoeView.ts`'s
 * fade-and-vanish marker, which resolves instantly). The server is the
 * sole authority for the turret's state; this view has no gameplay
 * authority of its own.
 */
const TURRET_BODY_RADIUS = 14;
const TURRET_FILL = 0x0b5c6b;
const TURRET_STROKE = 0x35e6ff;
const TURRET_RANGE_STROKE = 0x35e6ff;

export interface WorldSessionTurretView {
  readonly update: (snapshot: TownRoomTurretSnapshot) => void;
  readonly isExpired: (now: number) => boolean;
  readonly destroy: () => void;
}

export function createWorldSessionTurretView(
  scene: Phaser.Scene,
  snapshot: TownRoomTurretSnapshot,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionTurretView {
  const rangeRing = scene.add.circle(snapshot.x, snapshot.y, snapshot.attackRange, TURRET_RANGE_STROKE, 0.05);
  rangeRing.setStrokeStyle(1, TURRET_RANGE_STROKE, 0.35);
  rangeRing.setDepth(205);
  parentContainer?.add(rangeRing);

  const body = scene.add.circle(snapshot.x, snapshot.y, TURRET_BODY_RADIUS, TURRET_FILL, 0.9);
  body.setStrokeStyle(3, TURRET_STROKE, 0.95);
  body.setDepth(415);
  parentContainer?.add(body);

  scene.tweens.add({
    targets: body,
    scale: { from: 0.85, to: 1.1 },
    duration: 600,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  let expiresAtMs = snapshot.expiresAtMs;

  return {
    update: (nextSnapshot: TownRoomTurretSnapshot) => {
      body.setPosition(nextSnapshot.x, nextSnapshot.y);
      rangeRing.setPosition(nextSnapshot.x, nextSnapshot.y);
      rangeRing.setRadius(nextSnapshot.attackRange);
      expiresAtMs = nextSnapshot.expiresAtMs;
    },
    isExpired: (now: number) => now >= expiresAtMs,
    destroy: () => {
      scene.tweens.killTweensOf(body);
      body.destroy();
      rangeRing.destroy();
    },
  };
}
