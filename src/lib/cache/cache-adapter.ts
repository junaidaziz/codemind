/**
 * Cache Adapter Interface
 * Provides a unified interface for different caching backends (in-memory, Redis, etc.)
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheAdapter {
  /**
   * Get a value from the cache
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Set a value in the cache with optional TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time to live in milliseconds (optional)
   */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all entries from the cache
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics (optional, for monitoring)
   */
  stats?(): Promise<{
    size: number;
    hits?: number;
    misses?: number;
  }>;
}
