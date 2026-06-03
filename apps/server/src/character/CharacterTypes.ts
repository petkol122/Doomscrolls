import type {
  CharacterClassKey,
  CharacterDetails,
  CharacterName,
  CharacterSummary,
  OriginKey,
  PrimaryStats,
  DerivedStats,
} from "@doomscrolls/shared";

export interface CreateCharacterInput {
  readonly characterName: CharacterName;
  readonly originId: OriginKey;
  readonly classId: CharacterClassKey;
}

export interface CharacterNameValidationResult {
  readonly valid: boolean;
  readonly characterName: string;
  readonly normalized: string;
  readonly error?: string;
}

export interface StartingCharacterStats {
  readonly primary: PrimaryStats;
  readonly derived: DerivedStats;
}

export interface CharacterServiceConfig {
  readonly inventoryPageCount: number;
  readonly inventoryGridWidth: number;
  readonly inventoryGridHeight: number;
}

export const DEFAULT_CHARACTER_SERVICE_CONFIG: CharacterServiceConfig = {
  inventoryPageCount: 1,
  inventoryGridWidth: 10,
  inventoryGridHeight: 6,
};

export type ListCharactersResult = readonly CharacterSummary[];

export type CreateCharacterResult = CharacterDetails;