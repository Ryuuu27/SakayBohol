import {ResolvedGooglePlace, SavedOfflineRoute} from '../types/transit';

/**
 * Strict 30-calendar-day cache retention limit in compliance with
 * Google Maps Platform Service Specific Terms for temporary geospatial caching.
 */
export const GMP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const HUBS_CACHE_KEY = 'sakay_bohol_gmp_hubs_v1';
const ROUTES_CACHE_KEY = 'sakay_bohol_gmp_routes_v1';
const CURRENCY_PREF_KEY = 'sakay_bohol_currency_pref_v1';

export function loadCachedHubs(): Record<string, ResolvedGooglePlace> {
  try {
    const raw = localStorage.getItem(HUBS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ResolvedGooglePlace>;
    const now = Date.now();
    const valid: Record<string, ResolvedGooglePlace> = {};
    let mutated = false;
    for (const [key, place] of Object.entries(parsed)) {
      if (place && typeof place.cachedAt === 'number' && now - place.cachedAt < GMP_CACHE_TTL_MS) {
        valid[key] = place;
      } else {
        mutated = true;
      }
    }
    if (mutated) {
      localStorage.setItem(HUBS_CACHE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return {};
  }
}

export function saveCachedHubs(hubs: Record<string, ResolvedGooglePlace>): void {
  try {
    localStorage.setItem(HUBS_CACHE_KEY, JSON.stringify(hubs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedOfflineRoutes(): SavedOfflineRoute[] {
  try {
    const raw = localStorage.getItem(ROUTES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedOfflineRoute[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const valid = parsed.filter(
      (r) => r && typeof r.cachedAt === 'number' && now - r.cachedAt < GMP_CACHE_TTL_MS
    );
    if (valid.length !== parsed.length) {
      localStorage.setItem(ROUTES_CACHE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function upsertSavedOfflineRoute(route: SavedOfflineRoute): SavedOfflineRoute[] {
  const existing = loadSavedOfflineRoutes();
  const filtered = existing.filter((r) => r.id !== route.id);
  const next = [route, ...filtered].slice(0, 20);
  try {
    localStorage.setItem(ROUTES_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function removeSavedOfflineRoute(id: string): SavedOfflineRoute[] {
  const next = loadSavedOfflineRoutes().filter((r) => r.id !== id);
  try {
    localStorage.setItem(ROUTES_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function clearAllOfflineCache(): void {
  try {
    localStorage.removeItem(HUBS_CACHE_KEY);
    localStorage.removeItem(ROUTES_CACHE_KEY);
  } catch {
    // Ignore
  }
}

export function getPreferredCurrency(): string {
  try {
    return localStorage.getItem(CURRENCY_PREF_KEY) || 'USD';
  } catch {
    return 'USD';
  }
}

export function setPreferredCurrency(code: string): void {
  try {
    localStorage.setItem(CURRENCY_PREF_KEY, code);
  } catch {
    // Ignore
  }
}
