export const SESSION_TOKEN_STORAGE_KEY = "doomscrolls.sessionToken";
export const SELECTED_CHARACTER_ID_STORAGE_KEY = "doomscrolls.selectedCharacterId";
export const REMEMBER_ACCOUNT_STORAGE_KEY = "doomscrolls.rememberAccount";

// "Remember account" persists the session token in localStorage (survives
// browser restarts); declining it keeps the token in sessionStorage only
// (cleared when the tab closes). Both are checked on read so a token saved
// under either preference is still picked up.
export function readStoredSessionToken(): string | null {
  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ?? window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  return token === null || token.trim() === "" ? null : token;
}

export function readStoredSelectedCharacterId(): string | null {
  const characterId = window.localStorage.getItem(SELECTED_CHARACTER_ID_STORAGE_KEY);
  return characterId === null || characterId.trim() === "" ? null : characterId;
}

export function readRememberAccountPreference(): boolean {
  return window.localStorage.getItem(REMEMBER_ACCOUNT_STORAGE_KEY) !== "false";
}

export function storeSessionToken(token: string, rememberAccount: boolean): void {
  window.localStorage.setItem(REMEMBER_ACCOUNT_STORAGE_KEY, String(rememberAccount));
  if (rememberAccount) {
    window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  } else {
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  }
}

export function storeSelectedCharacterId(characterId: string): void {
  window.localStorage.setItem(SELECTED_CHARACTER_ID_STORAGE_KEY, characterId);
}

export function clearStoredSessionToken(): void {
  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
}

export function clearStoredSelectedCharacterId(): void {
  window.localStorage.removeItem(SELECTED_CHARACTER_ID_STORAGE_KEY);
}
