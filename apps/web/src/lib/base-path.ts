/** Single source of truth — must match `next.config` `basePath`. */
export const APP_BASE_PATH = "/market";

/** Prefix a path served from `/public` (e.g. `/hero.jpg`) so it works with `basePath`. */
export function publicUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_PATH}${normalized}`;
}
