export const MARKET_TOKEN_STORAGE_KEY = "market_jwt";
export const MARKET_ADMIN_TOKEN_STORAGE_KEY = "market_admin_jwt";

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(MARKET_TOKEN_STORAGE_KEY) ?? "";
}

export function getStoredAdminToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(MARKET_ADMIN_TOKEN_STORAGE_KEY) ?? "";
}

export function storeToken(token: string, role?: string) {
  if (typeof window === "undefined") return;

  const trimmed = token.trim();

  if (!trimmed) return;

  window.localStorage.setItem(MARKET_TOKEN_STORAGE_KEY, trimmed);

  if (role === "admin") {
    window.localStorage.setItem(MARKET_ADMIN_TOKEN_STORAGE_KEY, trimmed);
  }
}

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MARKET_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(MARKET_ADMIN_TOKEN_STORAGE_KEY);
}
