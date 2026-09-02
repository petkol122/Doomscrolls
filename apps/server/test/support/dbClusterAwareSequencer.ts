import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

/**
 * Core 0.18 Prisma-crash investigation, §8/§9
 * (docs/PRISMA_WINDOWS_TEARDOWN_CRASH_INVESTIGATION.md).
 *
 * The post-DI-refactor crash rate (§8) correlates with two real
 * `PrismaClient` constructions running back-to-back with zero other
 * test file's teardown in between -- confirmed by reproducing the
 * crash 2/3 times running just the four `*ObjectiveCoverage.test.ts`
 * combat files in isolation. Those four are the only `combat/` files
 * that construct a real client (each kills an enemy, which
 * unconditionally triggers `CombatRoom`'s XP-grant path), and they
 * happened to sort consecutively with no gap.
 *
 * Note this repo's default run order is not fixed alphabetically --
 * `BaseSequencer.sort()` orders by Vitest's own test-result cache
 * (failed-last-run first, then longest-duration first, falling back to
 * largest-file-first when no cache entry exists yet), so which files
 * land next to which shifts as that cache evolves. This sequencer
 * therefore does not assume or hardcode any fixed position for the
 * four target files or for anything else -- it inspects whatever order
 * `super.sort()` actually produces on each run and repositions only
 * the four targets within it.
 *
 * Every other file (the 8 `test/town/*.test.ts` suites, the other 9
 * `combat/*.test.ts` files that construct zero clients, and the 3
 * content/character files) keeps its exact relative order from
 * `super.sort()` -- this only ever inserts the four targets into gaps
 * between existing files, never reorders two non-target files relative
 * to each other.
 */
const TARGET_CLUSTER_SUFFIXES = [
  "test/combat/staticYardObjectiveCoverage.test.ts",
  "test/combat/saltmereDocksObjectiveCoverage.test.ts",
  "test/combat/combatZoneObjectiveCoverage.test.ts",
  "test/combat/cinderworksObjectiveCoverage.test.ts",
] as const;

function normalize(moduleId: string): string {
  return moduleId.replace(/\\/g, "/");
}

function isTargetCluster(spec: TestSpecification): boolean {
  const path = normalize(spec.moduleId);
  return TARGET_CLUSTER_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

/** Every TownRoom suite is DB-touching (see the investigation doc's §7/§8); used only to find safe gaps, never reordered. */
function isKnownDbTouching(spec: TestSpecification): boolean {
  return normalize(spec.moduleId).includes("/test/town/");
}

export class DbClusterAwareSequencer extends BaseSequencer {
  public async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const defaultOrder = await super.sort(files);

    const targets = defaultOrder.filter(isTargetCluster);
    const rest = defaultOrder.filter((spec) => !isTargetCluster(spec));

    if (targets.length === 0) {
      return defaultOrder;
    }

    // A gap at index `i` (meaning "insert before rest[i]"; i ===
    // rest.length means "at the very end") is safe for a target if
    // neither file adjacent to it is a known DB-touching file --
    // inserting a real-client-constructing target there cannot create
    // a new back-to-back construction on either side.
    const isSafeGap = (i: number): boolean => {
      const before = i > 0 ? rest[i - 1] : undefined;
      const after = i < rest.length ? rest[i] : undefined;
      return (before === undefined || !isKnownDbTouching(before))
        && (after === undefined || !isKnownDbTouching(after));
    };

    const safeGaps: number[] = [];
    for (let i = 0; i <= rest.length; i += 1) {
      if (isSafeGap(i)) {
        safeGaps.push(i);
      }
    }

    if (safeGaps.length < targets.length) {
      // Not enough DB-free gaps to isolate every target -- append them
      // at the end instead. Still no worse than the original
      // consecutive cluster; shouldn't arise given this suite's
      // current 12 DB-touching / 12 DB-free file split.
      return [...rest, ...targets];
    }

    // Stride evenly through the available safe gaps so the targets end
    // up spread across the whole file list, not bunched at one end.
    const chosenGaps = targets.map((_, i) => {
      const strideIndex = Math.floor((i * safeGaps.length) / targets.length);
      return safeGaps[strideIndex] ?? rest.length;
    });

    // Pair each target with its chosen gap and splice from the highest
    // gap index down, so inserting one target never shifts a
    // not-yet-processed gap index out from under it.
    const insertions = targets
      .map((target, i) => ({ target, gap: chosenGaps[i] ?? rest.length }))
      .sort((a, b) => b.gap - a.gap);

    const result = [...rest];
    for (const { target, gap } of insertions) {
      result.splice(gap, 0, target);
    }
    return result;
  }
}
