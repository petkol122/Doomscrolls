/**
 * Milestone 0.3 -- 4-Slot Flask Belt. Persisted charge counts, one per
 * belt slot (index 0 = flask_1 ... index 3 = flask_4), JSON-encoded
 * into `Character.flaskChargesJson`. Mirrors the `MaterialBalances`
 * build/parse pattern in `MaterialTypes.ts`. `undefined` at an index
 * means "no persisted value for this slot" (a fresh equip fills to max
 * instead of restoring a stale count).
 */
export type FlaskBeltPersistedCharges = readonly [
  number | undefined,
  number | undefined,
  number | undefined,
  number | undefined,
];

export function buildFlaskChargesJson(charges: FlaskBeltPersistedCharges): string {
  return JSON.stringify(charges.map((value) => (value === undefined ? null : value)));
}

export function parseFlaskChargesJson(raw: string | null | undefined): FlaskBeltPersistedCharges {
  if (raw === null || raw === undefined || raw.length === 0) {
    return [undefined, undefined, undefined, undefined];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [undefined, undefined, undefined, undefined];
    }
    const at = (index: number): number | undefined => {
      const value = parsed[index];
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    };
    return [at(0), at(1), at(2), at(3)];
  } catch {
    return [undefined, undefined, undefined, undefined];
  }
}
