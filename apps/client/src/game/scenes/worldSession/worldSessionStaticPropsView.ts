import Phaser from "phaser";

import {
  worldToScreenActiveProjection,
  type WorldProjectionBounds,
  type WorldProjectionMode,
  type WorldProjectionViewport,
} from "../../worldProjection";

type StaticPropKind = "crate" | "lamp" | "debris" | "junk";

interface StaticPropDefinition {
  readonly id: string;
  readonly zoneId: string;
  readonly kind: StaticPropKind;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

interface StaticPropScreenSnapshot extends StaticPropDefinition {
  readonly screenX: number;
  readonly screenY: number;
}

export interface WorldSessionStaticPropsView {
  readonly refresh: (projection: {
    readonly zoneId: string;
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
  }) => void;
  readonly destroy: () => void;
}

const STATIC_PROPS: readonly StaticPropDefinition[] = [
  { id: "nightmarket_crates_01", zoneId: "nightmarket", kind: "crate", label: "Crates", x: 420, y: 380 },
  { id: "nightmarket_lamp_01", zoneId: "nightmarket", kind: "lamp", label: "Lamp", x: 860, y: 520 },
  { id: "nightmarket_debris_01", zoneId: "nightmarket", kind: "debris", label: "Sewer Debris", x: 1180, y: 940 },
  { id: "nightmarket_junk_01", zoneId: "nightmarket", kind: "junk", label: "Market Junk", x: 1520, y: 700 },
  { id: "nightmarket_crates_02", zoneId: "nightmarket", kind: "crate", label: "Crates", x: 1890, y: 1120 },
] as const;

export function createWorldSessionStaticPropsView(scene: Phaser.Scene): WorldSessionStaticPropsView {
  const container = scene.add.container(0, 0);
  const propContainers = new Map<string, Phaser.GameObjects.Container>();

  const destroyAll = (): void => {
    for (const propContainer of propContainers.values()) {
      propContainer.destroy(true);
    }
    propContainers.clear();
  };

  const refresh = (projection: {
    readonly zoneId: string;
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
  }): void => {
    destroyAll();

    const visibleProps = STATIC_PROPS
      .filter((prop) => prop.zoneId === projection.zoneId)
      .map((prop) => projectProp(prop, projection))
      .filter((prop): prop is StaticPropScreenSnapshot => prop !== null)
      .sort((left, right) => left.y - right.y);

    for (const prop of visibleProps) {
      const propContainer = buildPropContainer(scene, prop);
      propContainers.set(prop.id, propContainer);
      container.add(propContainer);
    }
  };

  return {
    refresh,
    destroy: () => {
      destroyAll();
      container.destroy(true);
    },
  };
}

function projectProp(
  prop: StaticPropDefinition,
  projection: {
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
  },
): StaticPropScreenSnapshot | null {
  const width = projection.bounds.maxX - projection.bounds.minX;
  const height = projection.bounds.maxY - projection.bounds.minY;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const normalizedX = (prop.x - projection.bounds.minX) / width;
  const normalizedY = (prop.y - projection.bounds.minY) / height;
  if (
    !Number.isFinite(normalizedX) ||
    !Number.isFinite(normalizedY) ||
    normalizedX < 0 ||
    normalizedX > 1 ||
    normalizedY < 0 ||
    normalizedY > 1
  ) {
    return null;
  }

  const screenPosition = worldToScreenActiveProjection(
    prop.x,
    prop.y,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
  );

  return {
    ...prop,
    screenX: screenPosition.x,
    screenY: screenPosition.y,
  };
}

function buildPropContainer(
  scene: Phaser.Scene,
  prop: StaticPropScreenSnapshot,
): Phaser.GameObjects.Container {
  const propContainer = scene.add.container(prop.screenX, prop.screenY);
  const shadow = scene.add.ellipse(0, 12, 42, 16, 0x000000, 0.18);
  const label = scene.add
    .text(0, 18, prop.label, {
      color: "#c8b08d",
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      stroke: "#120e0a",
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  propContainer.add(shadow);

  switch (prop.kind) {
    case "crate": {
      const back = scene.add.rectangle(-8, -4, 18, 18, 0x6f4f2f, 0.95);
      back.setStrokeStyle(2, 0xa98052, 0.9);
      const front = scene.add.rectangle(8, 2, 18, 18, 0x8a6239, 0.98);
      front.setStrokeStyle(2, 0xc59a62, 0.95);
      propContainer.add([back, front]);
      break;
    }
    case "lamp": {
      const pole = scene.add.rectangle(0, -2, 5, 30, 0x4a4036, 0.98);
      const lantern = scene.add.circle(0, -20, 7, 0xf4d37a, 0.95);
      lantern.setStrokeStyle(2, 0x7a6430, 0.9);
      const glow = scene.add.ellipse(0, -20, 32, 24, 0xf4d37a, 0.16);
      propContainer.add([glow, pole, lantern]);
      break;
    }
    case "debris": {
      const pile = scene.add.triangle(-4, 2, 0, 16, 16, 8, 10, 0, 0x4f5e58, 0.95);
      pile.setStrokeStyle(2, 0x829087, 0.7);
      const scrap = scene.add.rectangle(10, 6, 14, 8, 0x6b5e4f, 0.95);
      scrap.setAngle(-18);
      scrap.setStrokeStyle(2, 0x9d8a72, 0.7);
      propContainer.add([pile, scrap]);
      break;
    }
    case "junk": {
      const sack = scene.add.circle(-8, 3, 9, 0x7d6747, 0.95);
      sack.setStrokeStyle(2, 0xaa8a60, 0.82);
      const crate = scene.add.rectangle(8, 2, 16, 12, 0x6c5534, 0.95);
      crate.setStrokeStyle(2, 0x9e7a4c, 0.85);
      const shard = scene.add.rectangle(0, -8, 10, 5, 0x9b7f59, 0.9);
      shard.setAngle(16);
      propContainer.add([sack, crate, shard]);
      break;
    }
  }

  propContainer.add(label);
  return propContainer;
}