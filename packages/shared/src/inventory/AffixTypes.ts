import type { StatModifier, StatModifierOperation, StatModifierTarget } from "../character/StatTypes";

/**
 * Milestone 0.3 -- Server-Authoritative Item Rarity & Random Affix Engine.
 *
 * `AffixRarityTier` is the per-*instance* rolled tier (how many affixes
 * an item instance rolled at drop time) -- distinct from the content
 * package's `ItemRarity` ("common"|"rare"|"epic"), which is a fixed tag
 * on the item's *template*. Two `starter_pipe` drops can both be
 * `ItemRarity: "common"` while one instance rolls `AffixRarityTier:
 * "rare"` and the other rolls "normal".
 */
export type AffixRarityTier = "normal" | "magic" | "rare" | "legendary";

/** One rolled affix, persisted verbatim on the `ItemInstance` row (as
 *  JSON, see `serializeRolledAffixes`/`parseRolledAffixes`) so the same
 *  roll is shown forever, not re-rolled on every read. */
export interface RolledAffix {
  readonly affixId: string;
  readonly kind: "prefix" | "suffix";
  readonly nameKey: string;
  readonly target: StatModifierTarget;
  readonly operation: StatModifierOperation;
  readonly value: number;
}

export function rolledAffixToStatModifier(affix: RolledAffix): StatModifier {
  return { target: affix.target, operation: affix.operation, value: affix.value };
}

export function serializeRolledAffixes(affixes: readonly RolledAffix[]): string {
  return JSON.stringify(affixes);
}

/** Tolerant parse: malformed/foreign JSON or a shape that doesn't match
 *  `RolledAffix` degrades to an empty affix list rather than throwing --
 *  a corrupt/legacy row should render as a plain item, never crash the
 *  inventory. */
export function parseRolledAffixes(raw: string | null | undefined): readonly RolledAffix[] {
  if (raw === null || raw === undefined || raw.length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRolledAffix);
  } catch {
    return [];
  }
}

function isRolledAffix(value: unknown): value is RolledAffix {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.affixId === "string" &&
    (candidate.kind === "prefix" || candidate.kind === "suffix") &&
    typeof candidate.nameKey === "string" &&
    typeof candidate.target === "string" &&
    (candidate.operation === "add" || candidate.operation === "multiply") &&
    typeof candidate.value === "number" &&
    Number.isFinite(candidate.value)
  );
}
