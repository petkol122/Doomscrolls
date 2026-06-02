export interface PrimaryStats {
  readonly power: number;
  readonly speed: number;
  readonly mind: number;
  readonly toughness: number;
}

export interface DerivedStats {
  readonly maxHp: number;
  readonly damage: number;
  readonly armor: number;
  readonly moveSpeed: number;
  readonly attackCooldownMs: number;
}

export interface CharacterStats {
  readonly primary: PrimaryStats;
  readonly derived: DerivedStats;
  readonly currentHp: number;
}

export type StatModifierTarget = keyof PrimaryStats | keyof DerivedStats;

export type StatModifierOperation = "add" | "multiply";

export interface StatModifier {
  readonly target: StatModifierTarget;
  readonly operation: StatModifierOperation;
  readonly value: number;
}