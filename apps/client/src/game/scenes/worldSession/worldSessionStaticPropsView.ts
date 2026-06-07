import Phaser from "phaser";
import { contentRegistry, type WorldPropContentDefinition } from "@doomscrolls/content";

import {
  worldToScreenActiveProjection,
  type WorldProjectionBounds,
  type WorldProjectionMode,
  type WorldProjectionViewport,
} from "../../worldProjection";

interface StaticPropScreenSnapshot extends WorldPropContentDefinition {
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

export function createWorldSessionStaticPropsView(
  scene: Phaser.Scene,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionStaticPropsView {
  const container = scene.add.container(0, 0);
  parentContainer?.add(container);
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

    const visibleProps = contentRegistry.worldProps.all
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
  prop: WorldPropContentDefinition,
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
  const isAmbientCreature = prop.kind === "ambient_rat" || prop.kind === "ambient_pig" || prop.kind === "ambient_chicken";
  const isCombatEdge = prop.kind === "combat_edge";
  const labelColor = isCombatEdge ? "#cc6666" : isAmbientCreature ? "#f2d96b" : "#c8b08d";
  const label = scene.add
    .text(0, 18, prop.label, {
      color: labelColor,
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      stroke: "#120e0a",
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  const stateLabel = isAmbientCreature
    ? scene.add
        .text(0, -16, "Neutral", {
          color: "#f5dc72",
          fontFamily: "Arial, sans-serif",
          fontSize: "10px",
          stroke: "#120e0a",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
    : null;

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
    case "ambient_rat": {
      const body = scene.add.ellipse(0, 4, 18, 10, 0x6d6d72, 0.98);
      body.setStrokeStyle(2, 0xa5a5ac, 0.85);
      const head = scene.add.circle(8, 1, 4, 0x7a7a81, 0.98);
      head.setStrokeStyle(2, 0xb7b7bf, 0.85);
      const ear = scene.add.circle(10, -4, 1.7, 0xcd97a8, 0.95);
      const tail = scene.add.ellipse(-11, 3, 14, 3, 0xc18aa0, 0.9);
      tail.setAngle(-18);
      propContainer.add([tail, body, head, ear]);
      break;
    }
    case "ambient_pig": {
      const body = scene.add.ellipse(0, 3, 28, 16, 0xd59cab, 0.98);
      body.setStrokeStyle(2, 0xf0c7d0, 0.9);
      const head = scene.add.circle(12, 1, 6, 0xe0aab7, 0.98);
      head.setStrokeStyle(2, 0xf7d3da, 0.9);
      const snout = scene.add.ellipse(15, 3, 7, 5, 0xf0c4cd, 0.98);
      const ear = scene.add.triangle(8, -6, 0, 6, 4, 0, 8, 6, 0xc98898, 0.95);
      propContainer.add([body, head, snout, ear]);
      break;
    }
    case "ambient_chicken": {
      const body = scene.add.ellipse(0, 4, 18, 14, 0xe9e0c8, 0.98);
      body.setStrokeStyle(2, 0xfff5de, 0.9);
      const head = scene.add.circle(7, -4, 4, 0xf0e7cf, 0.98);
      head.setStrokeStyle(2, 0xfff7e1, 0.88);
      const beak = scene.add.triangle(12, -3, 0, 2, 6, 0, 0, -2, 0xd8a236, 0.98);
      const comb = scene.add.circle(7, -9, 1.8, 0xcf4f4f, 0.95);
      const legLeft = scene.add.rectangle(-3, 13, 2, 7, 0xd79c3a, 0.95);
      const legRight = scene.add.rectangle(3, 13, 2, 7, 0xd79c3a, 0.95);
      propContainer.add([body, head, beak, comb, legLeft, legRight]);
      break;
    }
    case "combat_edge": {
      const edgeGraphic = scene.add.graphics();
      edgeGraphic.lineStyle(2, 0xcc4444, 0.6);
      edgeGraphic.strokeCircle(0, 0, 16);
      edgeGraphic.fillStyle(0xcc4444, 0.2);
      edgeGraphic.fillCircle(0, 0, 16);
      const dangerLine = scene.add.graphics();
      dangerLine.lineStyle(2, 0xcc4444, 0.8);
      dangerLine.lineBetween(-10, -10, 10, 10);
      dangerLine.lineBetween(-10, 10, 10, -10);
      propContainer.add([edgeGraphic, dangerLine]);
      break;
    }
  }

  if (stateLabel !== null) {
    propContainer.add(stateLabel);
  }
  propContainer.add(label);
  return propContainer;
}