export enum CharacterErrorCode {
  INVALID_CHARACTER_NAME = "INVALID_CHARACTER_NAME",
  CHARACTER_NAME_TAKEN = "CHARACTER_NAME_TAKEN",
  INVALID_ORIGIN = "INVALID_ORIGIN",
  INVALID_CLASS = "INVALID_CLASS",
  ORIGIN_CLASS_NOT_ALLOWED = "ORIGIN_CLASS_NOT_ALLOWED",
  CHARACTER_NOT_FOUND = "CHARACTER_NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

const DEFAULT_CHARACTER_ERROR_MESSAGES: Record<CharacterErrorCode, string> = {
  [CharacterErrorCode.INVALID_CHARACTER_NAME]: "Character name is invalid",
  [CharacterErrorCode.CHARACTER_NAME_TAKEN]: "Character name is already used by this account",
  [CharacterErrorCode.INVALID_ORIGIN]: "Origin is invalid",
  [CharacterErrorCode.INVALID_CLASS]: "Class is invalid",
  [CharacterErrorCode.ORIGIN_CLASS_NOT_ALLOWED]: "Class is not allowed for this origin",
  [CharacterErrorCode.CHARACTER_NOT_FOUND]: "Character was not found",
  [CharacterErrorCode.INTERNAL_ERROR]: "Internal character service error",
};

export class CharacterError extends Error {
  public constructor(
    public readonly code: CharacterErrorCode,
    message: string = DEFAULT_CHARACTER_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = "CharacterError";
  }
}