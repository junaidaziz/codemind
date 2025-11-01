import { logger } from '../app/lib/logger';
import { performanceProfiler } from './performance-profiler';

// Cache entry interface with LRU tracking
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number; // Size in bytes (approximate)
  compressed: boolean;
}

/**
 * Advanced in-memory cache with LRU eviction, compression, and performance tracking
 */
class AdvancedCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = []; // For LRU tracking
  private maxSize: number; // Max cache size in MB
  private currentSize: number = 0; // Current cache size in bytes
  private cleanupInterval: NodeJS.Timeout;
  private compressionEnabled: boolean;

  constructor(maxSizeMB: number = 100, compressionEnabled: boolean = false) {
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
    this.compressionEnabled = compressionEnabled;

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    const ttl = Date.now() + ttlSeconds * 1000;

    // Serialize and optionally compress the data
    const serialized = JSON.stringify(value);
    const data = value;
    let compressed = false;
    let size = serialized.length;

    if (this.compressionEnabled && serialized.length > 1024) {
      // Only compress if data is larger than 1KB
      try {
        // TODO: Replace with actual compression in production (e.g., zlib.gzip)
        // For now, simulate compression with approximate size reduction
        // In production, use: const compressed = await gzip(Buffer.from(serialized))
        compressed = true;
        size = Math.floor(serialized.length * 0.6); // Estimate ~40% compression ratio
      } catch (error) {
        logger.error('Compression failed', { key }, error as Error);
      }
    }

    // Check if we need to evict entries
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    // Remove from access order if it exists
    const existingIndex = this.accessOrder.indexOf(key);
    if (existingIndex > -1) {
      this.accessOrder.splice(existingIndex, 1);
      const existing = this.cache.get(key);
      if (existing) {
        this.currentSize -= existing.size;
      }
    }

    // Add to cache
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size,
      compressed,
    });

    // Add to end of access order (most recently used)
    this.accessOrder.push(key);
    this.currentSize += size;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      // Track cache miss
      await this.trackCacheAccess(key, false);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.ttl) {
      this.delete(key);
      await this.trackCacheAccess(key, false);
      return null;
    }

    // Update LRU order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }

    // Increment hit counter
    entry.hits++;

    // Track cache hit
    await this.trackCacheAccess(key, true, entry.size);

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
    }

    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
  }

  // Invalidate all keys matching a pattern
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  // Evict least recently used entry
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    logger.debug('Evicting LRU cache entry', { key: lruKey });
    this.delete(lruKey);
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.ttl) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cache cleanup completed', {
        entriesRemoved: cleaned,
        remainingEntries: this.cache.size,
        currentSizeMB: (this.currentSize / 1024 / 1024).toFixed(2),
      });
    }
  }

  // Track cache access for performance monitoring
  private async trackCacheAccess(
    key: string,
    isHit: boolean,
    size?: number
  ): Promise<void> {
    try {
      await performanceProfiler.recordMetric({
        metricType: 'cache_hit_rate',
        metricName: isHit ? 'cache_hit' : 'cache_miss',
        value: isHit ? 1 : 0,
        unit: 'boolean',
        metadata: {
          key,
          size,
          cacheSize: this.cache.size,
          cacheSizeMB: (this.currentSize / 1024 / 1024).toFixed(2),
        },
      });
    } catch (error) {
      // Don't throw - tracking failures shouldn't break cache
      logger.error('Failed to track cache access', { key, isHit }, error as Error);
    }
  }

  getStats(): {
    size: number;
    currentSizeMB: number;
    maxSizeMB: number;
    utilizationPercent: number;
    topEntries: Array<{ key: string; hits: number; age: number; size: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        hits: entry.hits,
        age: now - entry.timestamp,
        size: entry.size,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10); // Top 10 most hit entries

    return {
      size: this.cache.size,
      currentSizeMB: this.currentSize / 1024 / 1024,
      maxSizeMB: this.maxSize / 1024 / 1024,
      utilizationPercent: (this.currentSize / this.maxSize) * 100,
      topEntries: entries,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

/**
 * Enhanced cache service with advanced features
 */
export class EnhancedCacheService {
  private static instance: AdvancedCache | null = null;

  private static getInstance(): AdvancedCache {
    if (!EnhancedCacheService.instance) {
      // 100MB max cache size, compression enabled for large values
      EnhancedCacheService.instance = new AdvancedCache(100, true);
    }
    return EnhancedCacheService.instance;
  }

  // Generic cache methods
  static async get<T>(key: string): Promise<T | null> {
    try {
      return await EnhancedCacheService.getInstance().get<T>(key);
    } catch (error) {
      logger.error('Cache get error', { key }, error as Error);
      return null;
    }
  }

  static async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    try {
      await EnhancedCacheService.getInstance().set(key, value, ttlSeconds);
    } catch (error) {
      logger.error('Cache set error', { key, ttlSeconds }, error as Error);
    }
  }

  static async has(key: string): Promise<boolean> {
    try {
      return EnhancedCacheService.getInstance().has(key);
    } catch (error) {
      logger.error('Cache has error', { key }, error as Error);
      return false;
    }
  }

  static async delete(key: string): Promise<boolean> {
    try {
      return EnhancedCacheService.getInstance().delete(key);
    } catch (error) {
      logger.error('Cache delete error', { key }, error as Error);
      return false;
    }
  }

  static async clear(): Promise<void> {
    try {
      EnhancedCacheService.getInstance().clear();
    } catch (error) {
      logger.error('Cache clear error', {}, error as Error);
    }
  }

  static async invalidatePattern(pattern: string): Promise<number> {
    try {
      const deleted = EnhancedCacheService.getInstance().invalidatePattern(pattern);
      logger.info('Cache pattern invalidated', { pattern, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache invalidate pattern error', { pattern }, error as Error);
      return 0;
    }
  }

  // Cache statistics
  static getStats(): {
    size: number;
    currentSizeMB: number;
    maxSizeMB: number;
    utilizationPercent: number;
    topEntries: Array<{ key: string; hits: number; age: number; size: number }>;
  } {
    try {
      return EnhancedCacheService.getInstance().getStats();
    } catch (error) {
      logger.error('Cache stats error', {}, error as Error);
      return {
        size: 0,
        currentSizeMB: 0,
        maxSizeMB: 0,
        utilizationPercent: 0,
        topEntries: [],
      };
    }
  }

  static destroy(): void {
    if (EnhancedCacheService.instance) {
      EnhancedCacheService.instance.destroy();
      EnhancedCacheService.instance = null;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  static async warmCache(
    data: Array<{ key: string; value: unknown; ttl?: number }>
  ): Promise<void> {
    logger.info('Warming cache', { count: data.length });
    for (const item of data) {
      await EnhancedCacheService.set(item.key, item.value, item.ttl || 3600);
    }
  }
}

export const enhancedCache = EnhancedCacheService;
