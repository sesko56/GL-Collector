/**
 * Système de mémoire cache local pour GL Collector.
 * Utilise la mémoire vive (RAM) et le stockage local de l'appareil (localStorage)
 * pour éviter de recharger toute la page à chaque action ou navigation.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // en millisecondes
}

class DeviceCache {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private prefix = 'gl_collector_cache_';
  private readonly maxEntries = 30;

  /**
   * Récupère une entrée du cache (mémoire d'abord, puis stockage de l'appareil).
   */
  public get<T>(key: string): { data: T; isStale: boolean } | null {
    const now = Date.now();

    // 1. Vérification dans la mémoire vive
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key) as CacheEntry<T>;
      const isStale = now - entry.timestamp > entry.ttl;
      return { data: entry.data, isStale };
    }

    // 2. Vérification dans le stockage persistant de l'appareil
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (raw) {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        // Réinsère en mémoire vive pour les futurs accès instantanés
        this.memoryCache.set(key, entry);
        const isStale = now - entry.timestamp > entry.ttl;
        return { data: entry.data, isStale };
      }
    } catch {
      // Ignorer si le stockage local est restreint ou plein
    }

    return null;
  }

  /**
   * Enregistre des données dans le cache (mémoire vive + stockage local de l'appareil).
   * @param key Clé d'identification
   * @param data Données à mettre en cache
   * @param ttlMs Durée de vie en millisecondes (par défaut 5 minutes)
   */
  public set<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };

    // Mise en cache en mémoire vive
    this.memoryCache.set(key, entry);

    // Persistance sur la mémoire de l'appareil
    try {
      this.pruneLocalStorage();
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch {
      // Si quota dépassé, on purge les entrées périmées du stockage local
      this.pruneLocalStorage();
    }
  }

  /**
   * Invalide une ou plusieurs clés correspondant à un préfixe (ex: 'collection', 'bootstrap', 'auctions')
   */
  public invalidate(prefixOrKey: string): void {
    // Invalider en mémoire
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(prefixOrKey)) {
        this.memoryCache.delete(k);
      }
    }

    // Invalider dans le stockage local
    try {
      const targetPrefix = this.prefix + prefixOrKey;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(targetPrefix)) {
          keysToRemove.push(storageKey);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }

  /**
   * Nettoie les anciennes entrées du stockage local pour libérer de la mémoire
   */
  private pruneLocalStorage(): void {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const entry = JSON.parse(raw);
              if (now - entry.timestamp > entry.ttl * 2) {
                keysToRemove.push(k);
              }
            } catch {
              keysToRemove.push(k);
            }
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      const remaining: Array<{ key: string; timestamp: number }> = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(this.prefix)) continue;
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}') as CacheEntry<unknown>;
          remaining.push({ key, timestamp: entry.timestamp || 0 });
        } catch { localStorage.removeItem(key); }
      }
      remaining.sort((a, b) => a.timestamp - b.timestamp).slice(0, Math.max(0, remaining.length - this.maxEntries))
        .forEach(({ key }) => localStorage.removeItem(key));
    } catch {
      // Ignore
    }
  }

  /**
   * Vide l'intégralité du cache
   */
  public clear(): void {
    this.memoryCache.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }
}

export const deviceCache = new DeviceCache();
