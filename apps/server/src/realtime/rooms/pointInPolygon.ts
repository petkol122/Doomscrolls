import type { WorldPropPoint } from "@doomscrolls/content";

/**
 * Ray-casting point-in-polygon test. `points` must describe a simple
 * (non-self-intersecting) polygon in the same world units as `x`/`y`;
 * it does not need to be explicitly closed (first point repeated).
 */
export function isPointInPolygon(
  x: number,
  y: number,
  points: readonly WorldPropPoint[],
): boolean {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pointI = points[i]!;
    const pointJ = points[j]!;

    const intersects =
      pointI.y > y !== pointJ.y > y &&
      x <
        ((pointJ.x - pointI.x) * (y - pointI.y)) / (pointJ.y - pointI.y) +
          pointI.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/** True if `x`/`y` falls inside any of the given polygons. */
export function isPointInsideAnyPolygon(
  x: number,
  y: number,
  polygons: readonly (readonly WorldPropPoint[])[],
): boolean {
  return polygons.some((polygon) => isPointInPolygon(x, y, polygon));
}

function orientation(a: WorldPropPoint, b: WorldPropPoint, c: WorldPropPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: WorldPropPoint, b: WorldPropPoint, c: WorldPropPoint): boolean {
  return (
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y)
  );
}

function segmentsIntersect(
  p1: WorldPropPoint,
  p2: WorldPropPoint,
  p3: WorldPropPoint,
  p4: WorldPropPoint,
): boolean {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

/**
 * True if the straight movement step from (x1,y1) to (x2,y2) either ends
 * inside `points`, or crosses one of its edges along the way -- catching
 * a step whose destination happens to fall outside the building again
 * (e.g. a single fast tick "jumping" clean over a wall would otherwise
 * pass an endpoint-only inside/outside check).
 */
export function isSegmentBlockedByPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  points: readonly WorldPropPoint[],
): boolean {
  if (isPointInPolygon(x2, y2, points)) {
    return true;
  }

  const from = { x: x1, y: y1 };
  const to = { x: x2, y: y2 };

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    if (segmentsIntersect(from, to, points[i]!, points[j]!)) {
      return true;
    }
  }

  return false;
}

/** True if the movement step from (x1,y1) to (x2,y2) is blocked by any of the given polygons. */
export function isSegmentBlockedByAnyPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  polygons: readonly (readonly WorldPropPoint[])[],
): boolean {
  return polygons.some((polygon) => isSegmentBlockedByPolygon(x1, y1, x2, y2, polygon));
}
