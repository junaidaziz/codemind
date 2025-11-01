/**
 * Cache Module
 * Exports cache adapters and factory functions
 */

export type { CacheAdapter, CacheEntry } from './cache-adapter';
export { InMemoryCacheAdapter } from './memory-cache-adapter';
export { RedisCacheAdapter } from './redis-cache-adapter';
export { createCacheAdapter, getCacheAdapter, resetGlobalCache } from './cache-factory';
export type { CacheAdapterType } from './cache-factory';
