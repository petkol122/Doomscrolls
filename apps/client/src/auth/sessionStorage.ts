export const SESSION_TOKEN_STORAGE_KEY = "doomscrolls.sessionToken";
export const SELECTED_CHARACTER_ID_STORAGE_KEY = "doomscrolls.selectedCharacterId";

export function readStoredSessionToken(): string | null {
  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  return token === null || token.trim() === "" ? null : token;
}

export function readStoredSelectedCharacterId(): string | null {
  const characterId = window.localStorage.getItem(SELECTED_CHARACTER_ID_STORAGE_KEY);
  return characterId === null || characterId.trim() === "" ? null : characterId;
}

export function storeSessionToken(token: string): void {
  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
}

export function storeSelectedCharacterId(characterId: string): void {
  window.localStorage.setItem(SELECTED_CHARACTER_ID_STORAGE_KEY, characterId);
}

export function clearStoredSessionToken(): void {
  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
}

export function clearStoredSelectedCharacterId(): void {
  window.localStorage.removeItem(SELECTED_CHARACTER_ID_STORAGE_KEY);
}