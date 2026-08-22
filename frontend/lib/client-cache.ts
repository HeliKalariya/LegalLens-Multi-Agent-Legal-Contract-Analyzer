/**
 * Small per-browser-tab cache for page data. It makes returning to a page feel
 * immediate while the page silently asks the API for a fresh copy in the background.
 */
type CachedValue<T> = { savedAt: number; value: T };

const CACHE_PREFIX = "legallens:page-cache:";

export function readPageCache<T>(key: string, maxAgeMs = 60_000): T | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!rawValue) return null;
    const cached = JSON.parse(rawValue) as CachedValue<T>;
    if (!cached || Date.now() - cached.savedAt > maxAgeMs) return null;
    return cached.value;
  } catch {
    return null;
  }
}

export function writePageCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    const cached: CachedValue<T> = { savedAt: Date.now(), value };
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cached));
  } catch {
    // Storage may be unavailable or full. Fetching still works normally.
  }
}

export function clearPageCache(key: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
}
