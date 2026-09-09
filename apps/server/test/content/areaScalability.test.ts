import { describe, expect, it } from "vitest";
import {
  ContentRegistry,
  validateContentRegistry,
  origins,
  passives,
  classes,
  skills,
  enemies,
  items,
  lootTables,
  objectives,
  zones,
  levelTables,
  equipmentSlots,
  spawnPoints,
  worldProps,
  visualAssets,
  spawnZones,
  vendorStocks,
  townServices,
  lore,
  worlds,
  continents,
  areas
} from "@doomscrolls/content";
import type { AreaContentDefinition, ContinentContentId, ZoneContentDefinition, ZoneContentId, AreaContentId } from "@doomscrolls/content";

/**
 * Core 0.32 -- the actual pass/fail gate for the World Map Foundation's
 * central claim: adding a second area requires only content (new
 * coordinates, new zone authoring), not a second architecture. Builds
 * a real ContentRegistry -- the same class, the same
 * validateContentRegistry function, completely unmodified -- with a
 * synthetic second area/zone layered on top of the real registry's
 * other categories, and asserts it validates and resolves exactly the
 * way the real Pilsen data already does. If this test needed to touch
 * ContentRegistry.ts, ContentValidation.ts, or any client rendering
 * code to pass, Phase 1's architecture would have failed its own
 * stated goal.
 */
describe("area scalability (adding area #2 is content-only)", () => {
  const SYNTHETIC_AREA_ID = "test_second_city" as AreaContentId;
  const SYNTHETIC_ZONE_ID = "test_second_city_square" as ZoneContentId;

  const syntheticArea: AreaContentDefinition = {
    id: SYNTHETIC_AREA_ID,
    // Under the same real "europe" continent -- proving reuse across an
    // existing continent, not just an existing world.
    continentId: "europe" as ContinentContentId,
    // Reuses a real, already-resolvable localization key -- this fixture
    // doesn't need its own strings, only a valid reference.
    nameKey: "area.pilsen.name",
    descriptionKey: "area.pilsen.description",
    latitude: 50.0755,
    longitude: 14.4378
  };

  const syntheticZone: ZoneContentDefinition = {
    id: SYNTHETIC_ZONE_ID,
    zoneId: SYNTHETIC_ZONE_ID as unknown as ZoneContentDefinition["zoneId"],
    nameKey: "zone.namesti_republiky.name",
    descriptionKey: "zone.namesti_republiky.description",
    roomType: "town",
    classification: "safe_hub",
    maxPlayers: 30,
    enemyIds: [],
    transitionZoneIds: [],
    mapKey: "map_test_second_city_placeholder",
    areaId: SYNTHETIC_AREA_ID,
    bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 }
  };

  it("validates with a synthetic second area and zone present, using the real, unmodified ContentRegistry/validateContentRegistry", () => {
    const registry = new ContentRegistry({
      origins,
      passives,
      classes,
      skills,
      enemies,
      items,
      lootTables,
      objectives,
      zones: [...zones, syntheticZone],
      levelTables,
      equipmentSlots,
      spawnPoints,
      worldProps,
      visualAssets,
      spawnZones,
      vendorStocks,
      townServices,
      lore,
      worlds,
      continents,
      areas: [...areas, syntheticArea]
    });

    const result = validateContentRegistry(registry);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("resolves the second area's zone through the same areas/continents/worlds chain the real Pilsen area does", () => {
    const registry = new ContentRegistry({
      origins,
      passives,
      classes,
      skills,
      enemies,
      items,
      lootTables,
      objectives,
      zones: [...zones, syntheticZone],
      levelTables,
      equipmentSlots,
      spawnPoints,
      worldProps,
      visualAssets,
      spawnZones,
      vendorStocks,
      townServices,
      lore,
      worlds,
      continents,
      areas: [...areas, syntheticArea]
    });

    expect(registry.areas.all.length).toBe(areas.length + 1);

    const zone = registry.zones.require(SYNTHETIC_ZONE_ID);
    const area = registry.areas.require(zone.areaId);
    const continent = registry.continents.require(area.continentId);
    const world = registry.worlds.require(continent.worldId);

    expect(area.id).toBe(SYNTHETIC_AREA_ID);
    expect(continent.id).toBe("europe");
    expect(world.id).toBe("earth");

    // Same chain, same result shape, for the real Pilsen area -- proving
    // this isn't a coincidental one-off match for the synthetic fixture.
    const realZone = registry.zones.require("namesti_republiky" as ZoneContentId);
    const realArea = registry.areas.require(realZone.areaId);
    expect(realArea.id).toBe("pilsen");
    expect(registry.continents.require(realArea.continentId).id).toBe("europe");
  });
});
