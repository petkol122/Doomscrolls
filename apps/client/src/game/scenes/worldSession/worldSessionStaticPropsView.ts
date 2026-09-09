import Phaser from "phaser";
import { en } from "@doomscrolls/localization";
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
  /**
   * Core 0.35 -- only present for `points`-bearing kinds (building
   * footprints, street surfaces). Each point is already projected and
   * expressed relative to (screenX, screenY), so `buildPropContainer`
   * can hand them straight to a Phaser polygon local to the container.
   */
  readonly screenPoints?: readonly { readonly x: number; readonly y: number }[];
}

export interface WorldSessionStaticPropsView {
  readonly refresh: (projection: {
    readonly zoneId: string;
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
    readonly rotationDeg?: number;
  }) => void;
  readonly updateProjection: (projection: {
    readonly zoneId: string;
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
    readonly rotationDeg?: number;
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
  let currentZoneId: string | null = null;
  // Core 0.4x -- tracks the camera "shape" (world-units-per-pixel scale
  // on both axes, plus rotation) as of the last updateProjection call, so
  // a pure pan (the player walking -- refreshFromRoomState re-centers the
  // camera on the player almost every tick) can be told apart from an
  // actual zoom/rotation change. Under a pure pan, a polygon prop's
  // baked-in local `screenPoints` offsets are still valid (a translation
  // doesn't change relative distances between points) -- only the
  // container's anchor needs to move. Skipping the destroy/rebuild in
  // that (by far the most common, tick-by-tick) case is what makes
  // walking-while-buildings-render not lag/flicker; see the live report
  // that caught this.
  let lastCameraWidth: number | null = null;
  let lastCameraHeight: number | null = null;
  let lastRotationDeg: number | null = null;

  const getProjectedProps = (projection: {
    readonly zoneId: string;
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
    readonly rotationDeg?: number;
  }): StaticPropScreenSnapshot[] => contentRegistry.worldProps.all
    .filter((prop) => prop.zoneId === projection.zoneId)
    .map((prop) => projectProp(prop, projection))
    .filter((prop): prop is StaticPropScreenSnapshot => prop !== null)
    .sort((left, right) => left.y - right.y);

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
    readonly rotationDeg?: number;
  }): void => {
    destroyAll();
    currentZoneId = projection.zoneId;

    const visibleProps = getProjectedProps(projection);

    for (const prop of visibleProps) {
      const propContainer = buildPropContainer(scene, prop);
      propContainers.set(prop.id, propContainer);
      container.add(propContainer);
    }
  };

  const updateProjection = (projection: {
    readonly zoneId: string;
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
    readonly rotationDeg?: number;
  }): void => {
    if (currentZoneId !== projection.zoneId) {
      refresh(projection);
      return;
    }

    const cameraWidth = projection.bounds.maxX - projection.bounds.minX;
    const cameraHeight = projection.bounds.maxY - projection.bounds.minY;
    const rotationDeg = projection.rotationDeg ?? 0;
    // Core 0.4x -- see the field comments above: only an actual scale or
    // rotation change invalidates a polygon prop's baked-in local
    // vertices. A tiny epsilon absorbs float noise, not a real zoom step.
    const scaleOrRotationChanged =
      lastCameraWidth === null ||
      lastCameraHeight === null ||
      Math.abs(cameraWidth - lastCameraWidth) > 0.01 ||
      Math.abs(cameraHeight - lastCameraHeight) > 0.01 ||
      rotationDeg !== lastRotationDeg;
    lastCameraWidth = cameraWidth;
    lastCameraHeight = cameraHeight;
    lastRotationDeg = rotationDeg;

    const visibleProps = getProjectedProps(projection);
    const visibleIds = new Set(visibleProps.map((prop) => prop.id));

    // Core 0.4x -- `refresh()` only ever creates containers for props
    // that pass `projectProp`'s in-view filter (see `getProjectedProps`),
    // so a prop that scrolls/zooms out of view must have its container
    // destroyed here too -- otherwise it sits frozen in the scene at
    // whatever position/size it last had (a real bug found live: a
    // building rendered huge while zoomed in stayed huge and in place
    // after zooming back out past its now-offscreen centroid, since
    // nothing below ever destroyed it once it dropped out of
    // `visibleProps`).
    for (const [id, propContainer] of propContainers.entries()) {
      if (!visibleIds.has(id)) {
        propContainer.destroy(true);
        propContainers.delete(id);
      }
    }

    for (const prop of visibleProps) {
      const propContainer = propContainers.get(prop.id);

      // Core 0.4x -- symmetric with the removal above: a prop that just
      // scrolled/zoomed INTO view for the first time (no existing
      // container) needs one built now, not only at the next full
      // `refresh()`.
      if (propContainer === undefined) {
        const built = buildPropContainer(scene, prop);
        propContainers.set(prop.id, built);
        container.add(built);
        continue;
      }

      // Core 0.4x -- a plain reposition is only correct for point props,
      // or for a polygon prop under a PURE PAN (no scale/rotation
      // change) -- `building_footprint`/`street_surface` bake their
      // *shape* in as fixed local-space polygon vertices
      // (`screenPoints`, projected once inside `buildPropContainer`),
      // stored as offsets from the container's own anchor, so a
      // translation-only camera move (the overwhelmingly common case --
      // the camera re-centers on the player nearly every tick while
      // walking) leaves those offsets exactly correct; only the anchor
      // needs to move. Rebuilding on every tick regardless of whether
      // the scale actually changed was a real, live-caught perf/flicker
      // regression (every building/street polygon destroyed and
      // recreated on every room-state sync, i.e. multiple times a
      // second during ordinary movement) -- only rebuild when
      // `scaleOrRotationChanged` is actually true (a real zoom step or
      // the rare northRotationDeg case).
      if (prop.screenPoints !== undefined && scaleOrRotationChanged) {
        propContainer.destroy(true);
        const rebuilt = buildPropContainer(scene, prop);
        propContainers.set(prop.id, rebuilt);
        container.add(rebuilt);
        continue;
      }

      propContainer.setPosition(prop.screenX, prop.screenY);
      propContainer.setDepth(prop.screenY);
    }
  };

  return {
    refresh,
    updateProjection,
    destroy: () => {
      destroyAll();
      container.destroy();
    },
  };
}

function projectProp(
  prop: WorldPropContentDefinition,
  projection: {
    readonly bounds: WorldProjectionBounds;
    readonly viewport: WorldProjectionViewport;
    readonly projectionMode: WorldProjectionMode;
    readonly rotationDeg?: number;
  },
): StaticPropScreenSnapshot | null {
  const width = projection.bounds.maxX - projection.bounds.minX;
  const height = projection.bounds.maxY - projection.bounds.minY;
  if (width <= 0 || height <= 0) {
    return null;
  }

  // Core 0.4x -- a real building/street polygon can easily be larger
  // than the camera view (the cathedral alone is ~1657x1035 world
  // units), so culling it by whether its *centroid* alone is in view
  // was wrong: the moment the centroid crossed the frame edge, the
  // whole shape vanished even while most of it was still visibly on
  // screen (a live report caught this exactly: "disappears immediately
  // when a side goes out of frame but the rest is still in frame").
  // For anything with `points`, cull by whether its own world-space
  // bounding box overlaps the camera bounds at all, not by its center.
  if (prop.points !== undefined && prop.points.length > 0) {
    let propMinX = Infinity;
    let propMaxX = -Infinity;
    let propMinY = Infinity;
    let propMaxY = -Infinity;
    for (const point of prop.points) {
      if (point.x < propMinX) propMinX = point.x;
      if (point.x > propMaxX) propMaxX = point.x;
      if (point.y < propMinY) propMinY = point.y;
      if (point.y > propMaxY) propMaxY = point.y;
    }
    const overlapsCamera =
      propMaxX >= projection.bounds.minX &&
      propMinX <= projection.bounds.maxX &&
      propMaxY >= projection.bounds.minY &&
      propMinY <= projection.bounds.maxY;
    if (!overlapsCamera) {
      return null;
    }
  } else {
    // Point props (crates, lamps, markers, etc.) are small enough on
    // screen that culling by their own single anchor point is correct.
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
  }

  const screenPosition = worldToScreenActiveProjection(
    prop.x,
    prop.y,
    projection.bounds,
    projection.viewport,
    projection.projectionMode,
    projection.rotationDeg,
  );

  const screenPoints = prop.points?.map((point) => {
    const projected = worldToScreenActiveProjection(
      point.x,
      point.y,
      projection.bounds,
      projection.viewport,
      projection.projectionMode,
      projection.rotationDeg,
    );
    return { x: projected.x - screenPosition.x, y: projected.y - screenPosition.y };
  });

  return {
    ...prop,
    screenX: screenPosition.x,
    screenY: screenPosition.y,
    ...(screenPoints !== undefined ? { screenPoints } : {}),
  };
}

function resolvePropLabel(prop: StaticPropScreenSnapshot): string {
  if (prop.labelKey !== undefined && en[prop.labelKey] !== undefined) {
    return en[prop.labelKey];
  }
  return prop.label;
}

function buildPropContainer(
  scene: Phaser.Scene,
  prop: StaticPropScreenSnapshot,
): Phaser.GameObjects.Container {
  const propContainer = scene.add.container(prop.screenX, prop.screenY);
  const isAmbientCreature = prop.kind === "ambient_rat" || prop.kind === "ambient_pig" || prop.kind === "ambient_chicken";
  const isAreaLabel = prop.kind === "area_label";
  const isCombatEdge = prop.kind === "combat_edge";
  const isBoundaryMarker = prop.kind === "boundary_marker";
  const isSafeArea = prop.kind === "safe_area_marker";
  const isRestArea = prop.kind === "rest_area_marker";
  const isBuildingFootprint = prop.kind === "building_footprint";
  const isStreetSurface = prop.kind === "street_surface";
  const isWaterSurface = prop.kind === "water_surface";
  // A generic drop-shadow ellipse makes no sense under an arbitrarily
  // large real building/street/water polygon (it's sized for small point
  // props), and streets/water are flat ground -- none of them cast one.
  const shadow = isBuildingFootprint || isStreetSurface || isWaterSurface
    ? null
    : scene.add.ellipse(0, 12, 42, 16, 0x000000, 0.18);
  const labelColor = isSafeArea ? "#7ab87a" : isRestArea ? "#7ad8c0" : isAreaLabel ? "#8a7f6e" : (isCombatEdge || isBoundaryMarker) ? "#cc6666" : isAmbientCreature ? "#f2d96b" : "#c8b08d";
  const displayLabel = resolvePropLabel(prop);
  const labelFontSize = isAmbientCreature ? "9px" : isAreaLabel ? "13px" : "11px";
  const label = scene.add
    .text(0, 18, displayLabel, {
      color: isAmbientCreature ? "#b8a050" : labelColor,
      fontFamily: "Arial, sans-serif",
      fontSize: labelFontSize,
      fontStyle: isAmbientCreature ? "normal" : "normal",
      stroke: "#120e0a",
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  // No separate "Neutral" badge — the gold label color alone signals
  // ambient/neutral status, keeping the label layer less noisy.
  const stateLabel: null = null;

  if (shadow !== null) {
    propContainer.add(shadow);
  }
  // Ambient creature shadow stays minimal to reduce visual noise.

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
      dangerLine.lineBetween(-10, 10, 10, -1);
      propContainer.add([edgeGraphic, dangerLine]);
      break;
    }
    case "boundary_marker": {
      const wallBase = scene.add.rectangle(0, 0, 36, 10, 0x3d3024, 0.92);
      wallBase.setStrokeStyle(2, 0x6b5a42, 0.8);
      const wallTop = scene.add.rectangle(0, -6, 28, 6, 0x4a3d2e, 0.88);
      wallTop.setStrokeStyle(1, 0x5c4c36, 0.7);
      propContainer.add([wallBase, wallTop]);
      break;
    }
    case "safe_area_marker": {
      const ring = scene.add.graphics();
      ring.lineStyle(2, 0x5a9e5a, 0.45);
      ring.strokeCircle(0, 0, 14);
      ring.fillStyle(0x5a9e5a, 0.08);
      ring.fillCircle(0, 0, 14);
      const innerDot = scene.add.circle(0, 0, 3, 0x7ab87a, 0.5);
      propContainer.add([ring, innerDot]);
      break;
    }
    case "rest_area_marker": {
      const ring = scene.add.graphics();
      ring.lineStyle(2, 0x4ab8a0, 0.50);
      ring.strokeCircle(0, 0, 16);
      ring.fillStyle(0x4ab8a0, 0.10);
      ring.fillCircle(0, 0, 16);
      const innerRing = scene.add.graphics();
      innerRing.lineStyle(1, 0x7ad8c0, 0.35);
      innerRing.strokeCircle(0, 0, 10);
      const innerDot = scene.add.circle(0, 0, 3, 0x7ad8c0, 0.6);
      propContainer.add([ring, innerRing, innerDot]);
      break;
    }
    case "path_marker": {
      const dotA = scene.add.circle(-6, 4, 3, 0x5c4f3e, 0.6);
      dotA.setStrokeStyle(1, 0x7a6b55, 0.4);
      const dotB = scene.add.circle(6, -2, 2.5, 0x4f4334, 0.5);
      dotB.setStrokeStyle(1, 0x6e5f4b, 0.35);
      const dotC = scene.add.circle(2, 8, 2, 0x554839, 0.45);
      propContainer.add([dotA, dotB, dotC]);
      break;
    }
    case "area_label": {
      const bg = scene.add.rectangle(0, 0, 4, 2, 0x8a7f6e, 0.2);
      const deco = scene.add.text(0, -8, `— ${resolvePropLabel(prop)} —`, {
        color: "#8a7f6e",
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        stroke: "#0f0c09",
        strokeThickness: 4,
      }).setOrigin(0.5);
      propContainer.add([bg, deco]);
      break;
    }
    case "building_footprint": {
      // Real footprint, solid opaque mass -- deliberately no door/window
      // graphics and no interact affordance of any kind (this kind is
      // never registered as an interactable server-side either), so
      // nothing here should visually suggest an entrance exists yet.
      const flat = buildPolygonPoints(prop.screenPoints);
      if (flat !== null) {
        const wall = scene.add.polygon(0, 0, flat, 0x4a3f34, 0.96).setOrigin(0, 0);
        wall.setStrokeStyle(2, 0x2c241c, 0.9);
        propContainer.add(wall);
      }
      break;
    }
    case "street_surface": {
      const flat = buildPolygonPoints(prop.screenPoints);
      if (flat !== null) {
        const surface = scene.add.polygon(0, 0, flat, 0x54504a, 0.9).setOrigin(0, 0);
        surface.setStrokeStyle(1, 0x3e3b36, 0.4);
        propContainer.add(surface);
      }
      break;
    }
    case "water_surface": {
      const flat = buildPolygonPoints(prop.screenPoints);
      if (flat !== null) {
        const surface = scene.add.polygon(0, 0, flat, 0x2f5f7a, 0.85).setOrigin(0, 0);
        surface.setStrokeStyle(2, 0x1f4356, 0.6);
        propContainer.add(surface);
      }
      break;
    }
  }

  if (stateLabel !== null) {
    propContainer.add(stateLabel);
  }
  if (!isAreaLabel && !isBoundaryMarker && !isStreetSurface && displayLabel.length > 0) {
    propContainer.add(label);
  }
  return propContainer;
}

/**
 * Flattens projected polygon points into the `[x1, y1, x2, y2, ...]`
 * shape `scene.add.polygon` expects. Returns null when there aren't
 * enough points to form a shape (should never happen for valid
 * content -- ContentValidation.ts requires 3+ -- but rendering must
 * stay defensive against bad/missing data).
 */
function buildPolygonPoints(
  screenPoints: StaticPropScreenSnapshot["screenPoints"],
): number[] | null {
  if (screenPoints === undefined || screenPoints.length < 3) {
    return null;
  }
  return screenPoints.flatMap((point) => [point.x, point.y]);
}