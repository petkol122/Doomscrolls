export const SESSION_TOKEN_STORAGE_KEY = "doomscrolls.sessionToken";

export function readStoredSessionToken(): string | null {
  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  return token === null || token.trim() === "" ? null : token;
}

export function storeSessionToken(token: string): void {
  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
}

export function clearStoredSessionToken(): void {
  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
}