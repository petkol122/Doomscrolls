import type { CharacterNameValidationResult } from "./CharacterTypes";

const MIN_CHARACTER_NAME_LENGTH = 2;
const MAX_CHARACTER_NAME_LENGTH = 24;

// Allows Unicode letters/numbers, regular spaces, apostrophes and hyphens only.
const ALLOWED_CHARACTER_NAME_PATTERN = /^[\p{L}\p{N} '-]+$/u;

// Explicitly reject C0/C1 controls and DEL, including tabs/newlines.
 
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1F\x7F-\x9F]/u;

export class CharacterNameService {
  public validateCharacterName(input: string): CharacterNameValidationResult {
    const characterName = input.trim();
    const normalized = this.normalizeCharacterName(input);

    if (characterName.length === 0) {
      return {
        valid: false,
        characterName,
        normalized,
        error: "Character name is required",
      };
    }

    if (characterName.length < MIN_CHARACTER_NAME_LENGTH) {
      return {
        valid: false,
        characterName,
        normalized,
        error: `Character name must be at least ${MIN_CHARACTER_NAME_LENGTH} characters`,
      };
    }

    if (characterName.length > MAX_CHARACTER_NAME_LENGTH) {
      return {
        valid: false,
        characterName,
        normalized,
        error: `Character name must be at most ${MAX_CHARACTER_NAME_LENGTH} characters`,
      };
    }

    if (CONTROL_CHARACTER_PATTERN.test(characterName)) {
      return {
        valid: false,
        characterName,
        normalized,
        error: "Character name contains unsafe control characters",
      };
    }

    if (!ALLOWED_CHARACTER_NAME_PATTERN.test(characterName)) {
      return {
        valid: false,
        characterName,
        normalized,
        error: "Character name may only contain letters, numbers, spaces, apostrophes and hyphens",
      };
    }

    return { valid: true, characterName, normalized };
  }

  public normalizeCharacterName(input: string): string {
    return input.trim().toLocaleLowerCase("en-US");
  }
}