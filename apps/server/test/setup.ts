import { vi } from "vitest";

/**
 * Regression-test harness setup (see docs/CORE_BUILD_0_8_RELEASE_NOTES.md).
 *
 * These rooms persist character state through Prisma-backed services. The
 * harness in test/support/testRealtimeServer.ts boots a real, in-process
 * Colyseus server (via @colyseus/testing) so room registration, matchmaking
 * and message handlers all run for real -- but it does not stand up a
 * database. `CharacterService` and `ObjectiveRepository` are the two
 * persistence entry points every room join goes through
 * (RoomJoinValidationService -> CharacterService.getCharacterForUser;
 * CombatRoom/TownRoom.onJoin -> ObjectiveRepository), so they are mocked
 * here with an in-memory fixture instead. Every other repository stays
 * real but unused in these tests' code paths.
 */
vi.mock("../src/character/CharacterService", async () => {
  const { buildTestCharacterDetails, buildTestIroncladCharacterDetails, TEST_IRONCLAD_CHARACTER_ID } =
    await import("./support/fixtures");
  return {
    CharacterService: vi.fn().mockImplementation(() => ({
      // Core 0.9 -- branches on the requested characterId so a test can
      // join as either fixture class (see TEST_IRONCLAD_CHARACTER_ID)
      // without needing a per-test mock override.
      getCharacterForUser: vi.fn().mockImplementation((characterId: string) =>
        Promise.resolve(
          characterId === TEST_IRONCLAD_CHARACTER_ID
            ? buildTestIroncladCharacterDetails()
            : buildTestCharacterDetails(),
        ),
      ),
      updateCharacterLocation: vi.fn().mockResolvedValue(undefined),
      updateCharacterRoomIntent: vi.fn().mockResolvedValue(undefined),
      updateCharacterCurrentZone: vi.fn().mockResolvedValue(undefined),
      listCharacters: vi.fn().mockResolvedValue([]),
      createCharacter: vi.fn(),
    })),
  };
});

vi.mock("../src/persistence/repositories/ObjectiveRepository", () => ({
  ObjectiveRepository: vi.fn().mockImplementation(() => ({
    findByCharacterAndObjective: vi.fn().mockResolvedValue(null),
    findCompletedByCharacter: vi.fn().mockResolvedValue([]),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    markRewardGranted: vi.fn().mockResolvedValue(undefined),
    // Core 0.15 -- `request_start_board_objective` calls one of these
    // to persist a newly (re)started objective; neither was previously
    // exercised by any test.
    create: vi.fn().mockResolvedValue(undefined),
    startOrRestart: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
  })),
}));
