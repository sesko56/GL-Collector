import { deviceCache } from './cache';

const TOKEN_STORAGE_KEY = 'gl_collector_session_token';
const LEGACY_STORAGE_KEY = 'op_cards_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      deviceCache.clear();
    }
  } catch {
    // Ignore
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotent?: boolean;
  useCache?: boolean;
  cacheTTL?: number; // en ms
  invalidateCachePrefix?: string;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const method = options.method || 'GET';

  // Si lecture avec mise en cache activée (GET uniquement)
  // Les réponses authentifiées peuvent contenir des données de jeu privées : jamais de persistance locale.
  const canUsePersistentCache = method === 'GET' && options.useCache && !getStoredToken();
  if (canUsePersistentCache) {
    const cacheKey = `api_${path}`;
    const cached = deviceCache.get<T>(cacheKey);

    if (cached) {
      // Si donnée encore fraîche, renvoie immédiatement sans appel réseau
      if (!cached.isStale) {
        return cached.data;
      }
      // Si périmée, lance la mise à jour silencieuse en arrière-plan (stale-while-revalidate)
      fetchFromNetwork<T>(path, options)
        .then((freshData) => {
          deviceCache.set(cacheKey, freshData, options.cacheTTL ?? 3 * 60 * 1000);
        })
        .catch(() => {});
      return cached.data;
    }
  }

  // Appel réseau
  const result = await fetchFromNetwork<T>(path, options);

  // Mettre en cache si requis
  if (canUsePersistentCache) {
    const cacheKey = `api_${path}`;
    deviceCache.set(cacheKey, result, options.cacheTTL ?? 3 * 60 * 1000);
  }

  // Invalider le cache lors d'une mutation (POST, PATCH, DELETE)
  if (options.invalidateCachePrefix) {
    deviceCache.invalidate(options.invalidateCachePrefix);
  } else if (method !== 'GET') {
    // Invalidation par défaut selon l'action
    if (path.includes('/boosters')) deviceCache.invalidate('api_/api/bootstrap');
    if (path.includes('/auctions')) {
      deviceCache.invalidate('api_/api/auctions');
      deviceCache.invalidate('api_/api/bootstrap');
      deviceCache.invalidate('api_/api/collection');
    }
    if (path.includes('/auth')) deviceCache.clear();
  }

  return result;
}

async function fetchFromNetwork<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.idempotent) {
    headers['X-Idempotency-Key'] = `${path}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Erreur serveur (${res.status})`);
  }
  return data as T;
}
