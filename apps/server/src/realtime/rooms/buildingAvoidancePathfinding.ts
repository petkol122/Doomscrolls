import type { WorldPropPoint } from "@doomscrolls/content";
import { isSegmentBlockedByAnyPolygon } from "./pointInPolygon";

/**
 * How far outside a building's real outline a path-around waypoint is
 * placed. Keeps the walked route from visually hugging/clipping the
 * wall as the player rounds a corner.
 */
const PATH_CLEARANCE_UNITS = 20;

/**
 * Only buildings whose bounding box falls within this margin of the
 * requested straight-line segment are even considered as candidates.
 * The building actually blocking the direct line always falls inside
 * this margin by construction (its bbox necessarily overlaps the
 * segment's own bbox), so this never excludes the obstacle that
 * mattered -- only unrelated buildings elsewhere in the zone. Cheap,
 * but not sufficient alone: a click spanning most of a large zone
 * makes "near this segment" match nearly everything, which is why
 * {@link MAX_OBSTACLES_CONSIDERED} exists as a hard cap on top of it.
 */
const NEARBY_OBSTACLE_MARGIN_UNITS = 400;

/**
 * Hard cap on how many buildings ever go into a single visibility-graph
 * computation, regardless of how many match the margin above. A real
 * zone can carry 80+ building_footprint polygons with a dozen-plus
 * vertices each (real-world outlines, e.g. namesti_republiky); an
 * uncapped graph over every relevant-by-distance building blew up to a
 * near-billion-operation synchronous computation on a single long
 * `request_move` click and froze the whole (single-threaded) server.
 * Capping to the closest N candidates bounds every path computation to
 * the same small graph size no matter how far the click or how dense
 * the zone, at the cost of occasionally not finding the geometrically
 * optimal route through a very dense, spread-out cluster -- the
 * per-tick collision check in `stepTownRoomMovement.ts` still protects
 * against ever walking into a building even when that happens.
 */
const MAX_OBSTACLES_CONSIDERED = 12;

/**
 * Compute a sequence of waypoints (excluding the start, including the
 * final target) that walks from (startX, startY) to (targetX, targetY)
 * around any building_footprint polygon in the way -- Diablo/WoW-style
 * click-to-move that glides around obstacles instead of stopping dead
 * at the first wall it meets.
 *
 * Approach: a visibility graph, scoped to keep it cheap enough to run
 * synchronously on every accepted `request_move` no matter how large
 * or dense the zone:
 *  - each candidate obstacle is reduced to its convex hull (see
 *    {@link prepareObstacles}) -- always a safe superset of the real
 *    footprint, with far fewer vertices, and radial inflation from the
 *    centroid is exact for a convex shape
 *  - obstacles are filtered to ones near the requested segment, then
 *    hard-capped to the closest {@link MAX_OBSTACLES_CONSIDERED} (see
 *    {@link selectRelevantObstacles}) -- this is what actually bounds
 *    the graph size; the margin filter alone is not enough, since a
 *    click spanning most of a large zone makes "nearby" match almost
 *    every building in it
 *  - a hull's vertices, nudged outward by {@link PATH_CLEARANCE_UNITS},
 *    become graph nodes; two nodes are connected when the straight
 *    line between them doesn't cross any of the considered obstacles'
 *    real footprints; Dijkstra finds the shortest route through
 *
 * Falls back to a direct straight line to the target when the line is
 * already clear (the common case, resolved without building any graph
 * at all) or when no route around the buildings can be found (e.g. the
 * target is fully enclosed) -- the per-tick collision check in
 * `stepTownRoomMovement.ts` still protects against walking into a
 * building either way, so a fallback here is always safe, never
 * "silently broken."
 */
export function computeBuildingAvoidancePath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  buildingFootprints: readonly (readonly WorldPropPoint[])[],
): readonly WorldPropPoint[] {
  const directPath: readonly WorldPropPoint[] = [{ x: targetX, y: targetY }];

  if (buildingFootprints.length === 0) {
    return directPath;
  }

  if (!isSegmentBlockedByAnyPolygon(startX, startY, targetX, targetY, buildingFootprints)) {
    return directPath;
  }

  const obstacles = prepareObstacles(buildingFootprints);
  const relevantObstacles = selectRelevantObstacles(obstacles, startX, startY, targetX, targetY);
  const path = findPathThroughObstacles(startX, startY, targetX, targetY, relevantObstacles);

  return path ?? directPath;
}

interface PreparedObstacle {
  /** The real footprint -- used for the actual blocking test. */
  readonly footprint: readonly WorldPropPoint[];
  /** Convex hull of the footprint -- used as the graph's obstacle nodes. */
  readonly hull: readonly WorldPropPoint[];
  readonly bbox: BoundingBox;
}

interface BoundingBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Per-zone obstacle prep (hull + bounding box) is pure geometry derived
 * from static content data, so it's cached by the footprints array
 * identity -- `TownRoom` resolves that array once per room (see
 * `resolveZoneBuildingFootprints.ts`) and reuses the same reference for
 * every `request_move`, so this only actually runs once per room.
 */
const preparedObstaclesByFootprints = new WeakMap<
  readonly (readonly WorldPropPoint[])[],
  readonly PreparedObstacle[]
>();

function prepareObstacles(
  buildingFootprints: readonly (readonly WorldPropPoint[])[],
): readonly PreparedObstacle[] {
  const cached = preparedObstaclesByFootprints.get(buildingFootprints);
  if (cached !== undefined) {
    return cached;
  }

  const prepared = buildingFootprints.map((footprint) => ({
    footprint,
    hull: convexHull(footprint),
    bbox: computeBoundingBox(footprint),
  }));

  preparedObstaclesByFootprints.set(buildingFootprints, prepared);
  return prepared;
}

function computeBoundingBox(points: readonly WorldPropPoint[]): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  return { minX, maxX, minY, maxY };
}

function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function obstacleCenter(obstacle: PreparedObstacle): WorldPropPoint {
  return {
    x: (obstacle.bbox.minX + obstacle.bbox.maxX) / 2,
    y: (obstacle.bbox.minY + obstacle.bbox.maxY) / 2,
  };
}

/**
 * Narrow the full obstacle set down to a small, bounded list actually
 * worth building a visibility graph over: first by a loose bounding-box
 * margin around the segment, then by a hard cap on count, keeping only
 * the closest {@link MAX_OBSTACLES_CONSIDERED} to the segment. See the
 * module doc comment for why both steps are needed.
 */
function selectRelevantObstacles(
  obstacles: readonly PreparedObstacle[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): readonly PreparedObstacle[] {
  const segmentBox: BoundingBox = {
    minX: Math.min(x1, x2) - NEARBY_OBSTACLE_MARGIN_UNITS,
    maxX: Math.max(x1, x2) + NEARBY_OBSTACLE_MARGIN_UNITS,
    minY: Math.min(y1, y2) - NEARBY_OBSTACLE_MARGIN_UNITS,
    maxY: Math.max(y1, y2) + NEARBY_OBSTACLE_MARGIN_UNITS,
  };

  const nearby = obstacles.filter((obstacle) => boundingBoxesOverlap(obstacle.bbox, segmentBox));

  if (nearby.length <= MAX_OBSTACLES_CONSIDERED) {
    return nearby;
  }

  return nearby
    .map((obstacle) => {
      const center = obstacleCenter(obstacle);
      return { obstacle, distance: distancePointToSegment(center.x, center.y, x1, y1, x2, y2) };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_OBSTACLES_CONSIDERED)
    .map((entry) => entry.obstacle);
}

/**
 * Monotone-chain convex hull. Real building outlines here are close to
 * convex already; using the hull (rather than the raw outline) both
 * bounds the graph's vertex count and makes the radial centroid
 * inflation in {@link inflatePolygonVertices} exact. The hull is always
 * a superset of the original shape, so treating it as the obstacle for
 * pathfinding purposes never lets a route cross the real building --
 * it can only route slightly wider around a concave notch than
 * strictly necessary, which is an acceptable trade for a route that
 * finishes without stalling the server.
 */
function convexHull(points: readonly WorldPropPoint[]): readonly WorldPropPoint[] {
  if (points.length <= 3) {
    return points;
  }

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: WorldPropPoint, a: WorldPropPoint, b: WorldPropPoint): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: WorldPropPoint[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: WorldPropPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function polygonCentroid(points: readonly WorldPropPoint[]): WorldPropPoint {
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  return { x: sumX / points.length, y: sumY / points.length };
}

/** Push each hull vertex outward from the polygon's centroid by `clearance`. */
function inflatePolygonVertices(
  points: readonly WorldPropPoint[],
  clearance: number,
): readonly WorldPropPoint[] {
  const centroid = polygonCentroid(points);
  return points.map((point) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / length) * clearance,
      y: point.y + (dy / length) * clearance,
    };
  });
}

interface VisibilityGraph {
  readonly nodeCount: number;
  readonly neighborIndices: readonly (readonly number[])[];
  readonly neighborDistances: readonly (readonly number[])[];
}

function findPathThroughObstacles(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  obstacles: readonly PreparedObstacle[],
): readonly WorldPropPoint[] | null {
  if (obstacles.length === 0) {
    return null;
  }

  const start: WorldPropPoint = { x: startX, y: startY };
  const target: WorldPropPoint = { x: targetX, y: targetY };
  const footprints = obstacles.map((obstacle) => obstacle.footprint);
  const obstacleNodes = obstacles.flatMap((obstacle) =>
    inflatePolygonVertices(obstacle.hull, PATH_CLEARANCE_UNITS),
  );
  const nodes: readonly WorldPropPoint[] = [start, target, ...obstacleNodes];

  const graph = buildVisibilityGraph(nodes, footprints);
  const pathIndices = runDijkstra(graph, 0, 1);

  if (pathIndices === null) {
    return null;
  }

  // Drop the start node (index 0); callers want waypoints strictly
  // after the player's current position.
  return pathIndices.slice(1).map((index) => nodes[index]!);
}

function buildVisibilityGraph(
  nodes: readonly WorldPropPoint[],
  footprints: readonly (readonly WorldPropPoint[])[],
): VisibilityGraph {
  const neighborIndices: number[][] = nodes.map(() => []);
  const neighborDistances: number[][] = nodes.map(() => []);

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;

      if (isSegmentBlockedByAnyPolygon(a.x, a.y, b.x, b.y, footprints)) {
        continue;
      }

      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      neighborIndices[i]!.push(j);
      neighborDistances[i]!.push(distance);
      neighborIndices[j]!.push(i);
      neighborDistances[j]!.push(distance);
    }
  }

  return { nodeCount: nodes.length, neighborIndices, neighborDistances };
}

/** Plain O(n^2) Dijkstra -- fine for the small (well under 1,000 node) graphs this builds. */
function runDijkstra(graph: VisibilityGraph, startIndex: number, targetIndex: number): number[] | null {
  const { nodeCount, neighborIndices, neighborDistances } = graph;
  const distances = new Array<number>(nodeCount).fill(Infinity);
  const previous = new Array<number>(nodeCount).fill(-1);
  const visited = new Array<boolean>(nodeCount).fill(false);
  distances[startIndex] = 0;

  for (let iteration = 0; iteration < nodeCount; iteration++) {
    let currentIndex = -1;
    let currentDistance = Infinity;
    for (let i = 0; i < nodeCount; i++) {
      if (!visited[i]! && distances[i]! < currentDistance) {
        currentDistance = distances[i]!;
        currentIndex = i;
      }
    }

    if (currentIndex === -1 || currentIndex === targetIndex) {
      break;
    }

    visited[currentIndex] = true;

    const neighbors = neighborIndices[currentIndex]!;
    const weights = neighborDistances[currentIndex]!;
    for (let n = 0; n < neighbors.length; n++) {
      const neighborIndex = neighbors[n]!;
      const candidateDistance = currentDistance + weights[n]!;
      if (candidateDistance < distances[neighborIndex]!) {
        distances[neighborIndex] = candidateDistance;
        previous[neighborIndex] = currentIndex;
      }
    }
  }

  if (distances[targetIndex] === Infinity) {
    return null;
  }

  const path: number[] = [];
  let cursor = targetIndex;
  while (cursor !== -1) {
    path.unshift(cursor);
    cursor = previous[cursor]!;
  }
  return path;
}
