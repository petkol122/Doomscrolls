import type {
  CharacterDetails,
  CharacterId,
  UserId,
  ZoneId,
} from "@doomscrolls/shared";

export const TEST_USER_ID = "test-user-1" as UserId;
export const TEST_CHARACTER_ID = "test-character-1" as CharacterId;
export const TEST_IRONCLAD_CHARACTER_ID = "test-character-ironclad" as CharacterId;

/**
 * Deliberately non-fallback stats. `resolvePlayerMovementSpeed` and
 * `resolveAttackCooldownMs` both have safe fallback defaults for
 * missing/invalid stats, so a hardcoded-zero regression (Core 0.7 Task
 * 360's "Unplanned finding, fixed" -- see
 * docs/CORE_BUILD_0_7_RELEASE_NOTES.md) would not be caught by asserting
 * only "> 0". Using realistic, distinctive values lets the regression
 * test assert the exact derived numbers instead.
 */
export const TEST_CHARACTER_STATS = {
  primary: { power: 5, speed: 5, mind: 5, toughness: 5 },
  derived: { maxHp: 120, damage: 12, armor: 4, moveSpeed: 5, attackCooldownMs: 550 },
  currentHp: 80,
} as const;

export const TEST_MOVEMENT_SPEED_UNITS_PER_SECOND = 5 * 220;

export function buildTestCharacterDetails(
  overrides: Partial<CharacterDetails> = {},
): CharacterDetails {
  return {
    id: TEST_CHARACTER_ID,
    ownerUserId: TEST_USER_ID,
    characterName: "Test Gravewalker",
    originKey: "sewer_dweller",
    classKey: "gravewalker",
    level: 3,
    xp: 0,
    currentZoneId: "nightmarket" as ZoneId,
    moneyCopper: 0,
    stats: TEST_CHARACTER_STATS,
    createdAt: "2026-01-01T00:00:00.000Z" as CharacterDetails["createdAt"],
    updatedAt: "2026-01-01T00:00:00.000Z" as CharacterDetails["updatedAt"],
    passiveKeys: [],
    inventory: {
      characterId: TEST_CHARACTER_ID,
      config: { pageCount: 1, gridWidth: 10, gridHeight: 6 },
      items: [],
    },
    deathState: { lifeState: "alive" },
    ...overrides,
  };
}

/**
 * Core 0.9 -- a second class fixture, distinct from the default
 * Gravewalker fixture above, so tests can prove `resolveSkillSlotDefinition`
 * resolves the *joined* character's own class rather than a hardcoded
 * default (see `apps/server/test/setup.ts`, which branches
 * `CharacterService.getCharacterForUser` on `TEST_IRONCLAD_CHARACTER_ID`).
 */
export function buildTestIroncladCharacterDetails(
  overrides: Partial<CharacterDetails> = {},
): CharacterDetails {
  return buildTestCharacterDetails({
    id: TEST_IRONCLAD_CHARACTER_ID,
    characterName: "Test Ironclad",
    classKey: "ironclad",
    ...overrides,
  });
}
