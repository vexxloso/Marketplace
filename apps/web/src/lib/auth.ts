export const MARKET_TOKEN_STORAGE_KEY = "market_jwt";
export const MARKET_ADMIN_TOKEN_STORAGE_KEY = "market_admin_jwt";

const AUTH_CHANGED_EVENT = "market-auth-changed";

export function emitAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function subscribeAuthChanged(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === MARKET_TOKEN_STORAGE_KEY || e.key === MARKET_ADMIN_TOKEN_STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener(AUTH_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

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
  emitAuthChanged();
}

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MARKET_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(MARKET_ADMIN_TOKEN_STORAGE_KEY);
  emitAuthChanged();
}

/** Clears session tokens and notifies listeners (nav, dashboard, etc.). */
export function signOut() {
  clearStoredTokens();
}
