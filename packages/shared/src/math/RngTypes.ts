/**
 * Weighted entry for RNG pickWeighted selection.
 */
export interface WeightedEntry<TId extends string> {
  /** Unique identifier for the entry. */
  id: TId;
  /** Relative weight (must be finite and positive). */
  weight: number;
}

/**
 * Result of a weighted pick operation.
 */
export interface WeightedPickResult<TId extends string> {
  /** The selected entry's id. */
  id: TId;
  /** The selected entry's weight. */
  weight: number;
}