import Phaser from "phaser";

import type { TownRoomProjectileSnapshot } from "../../../net/townRoomProjectiles";

// Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
// Skills. A small, self-contained per-projectile view following
// `worldSessionEnemyPlaceholderView.ts`'s primitive-shapes style: no new
// sprite asset, just a filled circle. The server is the sole authority
// for position -- `update()` snaps to the synced x/y each state change,
// matching how enemy/player placeholders already snap (no client-side
// interpolation).
const PROJECTILE_RADIUS = 6;
const PROJECTILE_COLOR = 0xffd23f;
const PROJECTILE_STROKE = 0x6b4a00;

// Milestone 0.3 -- Netrunner Urban-Magic Class Archetype. malware_surge
// gets a blue/cyan techwear tint instead of the default warm bolt color,
// so its EMP-flavored projectile reads visually distinct from the other
// classes' physical/grave-energy skills.
const NETRUNNER_PROJECTILE_SKILL_IDS = new Set(["malware_surge"]);
const NETRUNNER_PROJECTILE_COLOR = 0x35e6ff;
const NETRUNNER_PROJECTILE_STROKE = 0x0b5c6b;

export interface WorldSessionProjectileView {
  readonly update: (snapshot: TownRoomProjectileSnapshot) => void;
  readonly destroy: () => void;
}

export function createWorldSessionProjectileView(
  scene: Phaser.Scene,
  snapshot: TownRoomProjectileSnapshot,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionProjectileView {
  const isNetrunnerSkill = NETRUNNER_PROJECTILE_SKILL_IDS.has(snapshot.skillId);
  const fillColor = isNetrunnerSkill ? NETRUNNER_PROJECTILE_COLOR : PROJECTILE_COLOR;
  const strokeColor = isNetrunnerSkill ? NETRUNNER_PROJECTILE_STROKE : PROJECTILE_STROKE;

  const body = scene.add.circle(snapshot.x, snapshot.y, PROJECTILE_RADIUS, fillColor, 0.95);
  body.setStrokeStyle(2, strokeColor, 0.9);
  body.setDepth(420);
  parentContainer?.add(body);

  return {
    update: (nextSnapshot: TownRoomProjectileSnapshot) => {
      body.setPosition(nextSnapshot.x, nextSnapshot.y);
    },
    destroy: () => {
      body.destroy();
    },
  };
}
