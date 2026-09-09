import { describe, expect, it } from "vitest";
import {
  isPointInPolygon,
  isPointInsideAnyPolygon,
  isSegmentBlockedByAnyPolygon,
} from "../../src/realtime/rooms/pointInPolygon";
import { computeBuildingAvoidancePath } from "../../src/realtime/rooms/buildingAvoidancePathfinding";
import { resolveZoneBuildingFootprints } from "../../src/realtime/rooms/resolveZoneBuildingFootprints";
import { stepTownRoomMovement } from "../../src/realtime/rooms/stepTownRoomMovement";
import { TownRoomState } from "../../src/realtime/rooms/TownRoomState";
import { PlayerPresence } from "../../src/realtime/rooms/PlayerPresence";

const SQUARE_BUILDING = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

function makePresence(x: number, y: number, targetX: number, targetY: number): PlayerPresence {
  const presence = new PlayerPresence(
    "session-1",
    "character-1" as never,
    "Tester",
    "brawler" as never,
    1,
    0,
    "namesti_republiky_spawn" as never,
    100,
    100,
    x,
    y,
    500,
    1000,
    10,
    0,
  );
  presence.targetX = targetX;
  presence.targetY = targetY;
  presence.hasMovementTarget = true;
  presence.lifeState = "alive";
  return presence;
}

describe("isPointInPolygon / isPointInsideAnyPolygon", () => {
  it("reports a point inside the polygon as inside", () => {
    expect(isPointInPolygon(50, 50, SQUARE_BUILDING)).toBe(true);
  });

  it("reports a point outside the polygon as outside", () => {
    expect(isPointInPolygon(500, 500, SQUARE_BUILDING)).toBe(false);
  });

  it("checks a point against multiple polygons", () => {
    const other = [
      { x: 200, y: 200 },
      { x: 300, y: 200 },
      { x: 300, y: 300 },
      { x: 200, y: 300 },
    ];
    expect(isPointInsideAnyPolygon(250, 250, [SQUARE_BUILDING, other])).toBe(true);
    expect(isPointInsideAnyPolygon(1000, 1000, [SQUARE_BUILDING, other])).toBe(false);
  });
});

describe("isSegmentBlockedByAnyPolygon", () => {
  it("blocks a step that lands inside a polygon", () => {
    expect(isSegmentBlockedByAnyPolygon(-50, 50, 50, 50, [SQUARE_BUILDING])).toBe(true);
  });

  it("blocks a step whose straight line crosses a polygon even if it lands beyond it", () => {
    expect(isSegmentBlockedByAnyPolygon(-50, 50, 300, 50, [SQUARE_BUILDING])).toBe(true);
  });

  it("allows a step whose straight line never touches the polygon", () => {
    expect(isSegmentBlockedByAnyPolygon(500, 500, 550, 500, [SQUARE_BUILDING])).toBe(false);
  });
});

describe("computeBuildingAvoidancePath", () => {
  it("returns a direct single-waypoint path when the line is already clear", () => {
    const path = computeBuildingAvoidancePath(500, 500, 550, 500, [SQUARE_BUILDING]);
    expect(path).toEqual([{ x: 550, y: 500 }]);
  });

  it("returns a direct single-waypoint path when there are no buildings", () => {
    const path = computeBuildingAvoidancePath(-50, 50, 300, 50, []);
    expect(path).toEqual([{ x: 300, y: 50 }]);
  });

  it("routes around a building blocking the straight line, ending at the target", () => {
    const path = computeBuildingAvoidancePath(-50, 50, 300, 50, [SQUARE_BUILDING]);

    expect(path.length).toBeGreaterThan(1);
    const last = path[path.length - 1]!;
    expect(last.x).toBe(300);
    expect(last.y).toBe(50);

    // Every leg of the route, including from the start, must clear the building.
    let fromX = -50;
    let fromY = 50;
    for (const waypoint of path) {
      expect(isSegmentBlockedByAnyPolygon(fromX, fromY, waypoint.x, waypoint.y, [SQUARE_BUILDING])).toBe(
        false,
      );
      fromX = waypoint.x;
      fromY = waypoint.y;
    }
  });

  it("stays fast against namesti_republiky's real ~80 building footprints (regression guard)", () => {
    // namesti_republiky is real-world-grounded content with 80+
    // building_footprint polygons averaging a dozen-plus vertices each
    // (see docs/CORE_BUILD_0_33_PLAN.md). A naive visibility graph over
    // every building in the zone regardless of relevance blew up to a
    // near-billion-operation synchronous computation on a single
    // request_move and froze the whole (single-threaded) server -- this
    // guards against that regression by asserting a worst-case diagonal
    // across the entire zone still resolves quickly.
    const buildingFootprints = resolveZoneBuildingFootprints("namesti_republiky" as never);
    expect(buildingFootprints.length).toBeGreaterThan(20);

    const startedAt = Date.now();
    const path = computeBuildingAvoidancePath(-2238, -3330, 7303, 6935, buildingFootprints);
    const elapsedMs = Date.now() - startedAt;

    expect(path.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(100);
  });
});

describe("stepTownRoomMovement building collision", () => {
  it("stops a player whose target lands inside a building instead of moving them there", () => {
    const state = new TownRoomState("namesti_republiky" as never);
    const presence = makePresence(-50, 50, 50, 50);
    state.playerPresence.set("session-1", presence);

    stepTownRoomMovement(state, 1000, { buildingFootprints: [SQUARE_BUILDING] });

    expect(presence.hasMovementTarget).toBe(false);
    expect(presence.x).toBe(-50);
    expect(presence.y).toBe(50);
  });

  it("stops a player before stepping through a building that lies on the path", () => {
    const state = new TownRoomState("namesti_republiky" as never);
    // Target is on the far side of the building; a single large tick
    // would otherwise land the player inside it.
    const presence = makePresence(-50, 50, 300, 50);
    state.playerPresence.set("session-1", presence);

    stepTownRoomMovement(state, 1000, { buildingFootprints: [SQUARE_BUILDING] });

    expect(presence.hasMovementTarget).toBe(false);
    expect(isPointInPolygon(presence.x, presence.y, SQUARE_BUILDING)).toBe(false);
    expect(presence.x).toBe(-50);
    expect(presence.y).toBe(50);
  });

  it("moves the player normally when no building blocks the path", () => {
    const state = new TownRoomState("namesti_republiky" as never);
    const presence = makePresence(500, 500, 550, 500);
    state.playerPresence.set("session-1", presence);

    stepTownRoomMovement(state, 1000, { buildingFootprints: [SQUARE_BUILDING] });

    expect(presence.hasMovementTarget).toBe(false);
    expect(presence.x).toBe(550);
    expect(presence.y).toBe(500);
  });

  it("moves the player normally when buildingFootprints is omitted", () => {
    const state = new TownRoomState("namesti_republiky" as never);
    const presence = makePresence(-50, 50, 50, 50);
    state.playerPresence.set("session-1", presence);

    stepTownRoomMovement(state, 1000);

    expect(presence.hasMovementTarget).toBe(false);
    expect(presence.x).toBe(50);
    expect(presence.y).toBe(50);
  });

  it("glides around a building via queued pathWaypoints instead of stopping at it", () => {
    const state = new TownRoomState("namesti_republiky" as never);
    const path = computeBuildingAvoidancePath(-50, 50, 300, 50, [SQUARE_BUILDING]);
    const [firstWaypoint, ...rest] = path;
    const presence = makePresence(-50, 50, firstWaypoint!.x, firstWaypoint!.y);
    presence.pathWaypoints = rest.flatMap((waypoint) => [waypoint.x, waypoint.y]).join(",");
    state.playerPresence.set("session-1", presence);

    // Small ticks, like the real 50ms simulation interval, so the walk
    // is gradual rather than arriving in one giant leap.
    for (let tick = 0; tick < 200 && presence.hasMovementTarget; tick++) {
      stepTownRoomMovement(state, 50, { buildingFootprints: [SQUARE_BUILDING] });
      expect(isPointInPolygon(presence.x, presence.y, SQUARE_BUILDING)).toBe(false);
    }

    expect(presence.hasMovementTarget).toBe(false);
    expect(presence.pathWaypoints).toBe("");
    expect(presence.x).toBeCloseTo(300, 0);
    expect(presence.y).toBeCloseTo(50, 0);
  });
});
