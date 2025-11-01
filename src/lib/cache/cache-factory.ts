/**
 * Cache Factory
 * Creates the appropriate cache adapter based on environment configuration
 */

import { CacheAdapter } from './cache-adapter';
import { InMemoryCacheAdapter } from './memory-cache-adapter';
import { RedisCacheAdapter } from './redis-cache-adapter';

export type CacheAdapterType = 'memory' | 'redis';

/**
 * Create a cache adapter based on environment configuration
 * @param type - Adapter type (defaults to env CACHE_ADAPTER or 'memory')
 * @param options - Optional configuration
 */
export function createCacheAdapter(
  type?: CacheAdapterType,
  options?: { maxEntries?: number; redisUrl?: string }
): CacheAdapter {
  const adapterType = type || (process.env.CACHE_ADAPTER as CacheAdapterType) || 'memory';

  switch (adapterType) {
    case 'redis':
      return new RedisCacheAdapter(options?.redisUrl);
    case 'memory':
    default:
      return new InMemoryCacheAdapter(options?.maxEntries);
  }
}

/**
 * Singleton cache instance for application-wide use
 */
let globalCache: CacheAdapter | null = null;

export function getCacheAdapter(): CacheAdapter {
  if (!globalCache) {
    globalCache = createCacheAdapter();
  }
  return globalCache;
}

/**
 * Reset the global cache (useful for testing)
 */
export function resetGlobalCache(): void {
  globalCache = null;
}
