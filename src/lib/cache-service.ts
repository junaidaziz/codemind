import { logger } from '../app/lib/logger';

// Cache entry interface
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Simple in-memory cache for analytics data
// In production, this would be replaced with Redis or similar
class InMemoryCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set(key: string, value: unknown, ttlSeconds: number = 300): void {
    const ttl = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Delete all keys matching a pattern
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cache cleanup completed', {
        entriesRemoved: cleaned,
        remainingEntries: this.cache.size,
      });
    }
  }

  getStats(): {
    size: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl - now,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Cache service for analytics data
export class CacheService {
  private static instance: InMemoryCache | null = null;

  private static getInstance(): InMemoryCache {
    if (!CacheService.instance) {
      CacheService.instance = new InMemoryCache();
    }
    return CacheService.instance;
  }

  // Generic cache methods
  static async get<T>(key: string): Promise<T | null> {
    try {
      return CacheService.getInstance().get<T>(key);
    } catch (error) {
      logger.error('Cache get error', { key }, error as Error);
      return null;
    }
  }

  static async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    try {
      CacheService.getInstance().set(key, value, ttlSeconds);
    } catch (error) {
      logger.error('Cache set error', { key, ttlSeconds }, error as Error);
    }
  }

  static async has(key: string): Promise<boolean> {
    try {
      return CacheService.getInstance().has(key);
    } catch (error) {
      logger.error('Cache has error', { key }, error as Error);
      return false;
    }
  }

  static async delete(key: string): Promise<boolean> {
    try {
      return CacheService.getInstance().delete(key);
    } catch (error) {
      logger.error('Cache delete error', { key }, error as Error);
      return false;
    }
  }

  static async clear(): Promise<void> {
    try {
      CacheService.getInstance().clear();
    } catch (error) {
      logger.error('Cache clear error', {}, error as Error);
    }
  }

  static async invalidatePattern(pattern: string): Promise<number> {
    try {
      const deleted = CacheService.getInstance().invalidatePattern(pattern);
      logger.info('Cache pattern invalidated', { pattern, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache invalidate pattern error', { pattern }, error as Error);
      return 0;
    }
  }

  // Analytics-specific cache methods
  static async getProjectAnalytics(projectId: string): Promise<unknown | null> {
    return CacheService.get(`analytics:project:${projectId}`);
  }

  static async setProjectAnalytics(projectId: string, data: unknown, ttlSeconds: number = 300): Promise<void> {
    await CacheService.set(`analytics:project:${projectId}`, data, ttlSeconds);
  }

  static async invalidateProjectAnalytics(projectId: string): Promise<void> {
    await CacheService.invalidatePattern(`analytics:project:${projectId}*`);
  }

  static async getContributorAnalytics(projectId: string, username: string): Promise<unknown | null> {
    return CacheService.get(`analytics:contributor:${projectId}:${username}`);
  }

  static async setContributorAnalytics(projectId: string, username: string, data: unknown, ttlSeconds: number = 300): Promise<void> {
    await CacheService.set(`analytics:contributor:${projectId}:${username}`, data, ttlSeconds);
  }

  static async getGitHubSync(projectId: string): Promise<unknown | null> {
    return CacheService.get(`github:sync:${projectId}`);
  }

  static async setGitHubSync(projectId: string, data: unknown, ttlSeconds: number = 180): Promise<void> {
    await CacheService.set(`github:sync:${projectId}`, data, ttlSeconds);
  }

  // Real-time updates tracking
  static async markProjectAsUpdated(projectId: string): Promise<void> {
    const timestamp = Date.now();
    await CacheService.set(`updates:project:${projectId}`, timestamp, 3600); // 1 hour TTL
    
    // Invalidate related cached analytics
    await CacheService.invalidateProjectAnalytics(projectId);
    
    logger.info('Project marked as updated', { projectId, timestamp });
  }

  static async getLastProjectUpdate(projectId: string): Promise<number | null> {
    return CacheService.get<number>(`updates:project:${projectId}`);
  }

  // Webhook processing status
  static async setWebhookProcessing(projectId: string, eventType: string, deliveryId: string): Promise<void> {
    const processingInfo = {
      eventType,
      deliveryId,
      timestamp: Date.now(),
      status: 'processing',
    };
    await CacheService.set(`webhook:${projectId}:${deliveryId}`, processingInfo, 600); // 10 minutes
  }

  static async setWebhookCompleted(projectId: string, deliveryId: string, result: Record<string, unknown>): Promise<void> {
    const processingInfo = {
      ...result,
      timestamp: Date.now(),
      status: 'completed',
    };
    await CacheService.set(`webhook:${projectId}:${deliveryId}`, processingInfo, 3600); // 1 hour
  }

  static async getWebhookStatus(projectId: string, deliveryId: string): Promise<unknown | null> {
    return CacheService.get(`webhook:${projectId}:${deliveryId}`);
  }

  // Analytics dashboard refresh tracking
  static async shouldRefreshAnalytics(projectId: string, maxAgeMs: number = 300000): Promise<boolean> {
    const lastUpdate = await CacheService.getLastProjectUpdate(projectId);
    if (!lastUpdate) return true;
    
    return (Date.now() - lastUpdate) > maxAgeMs;
  }

  // Cache statistics and monitoring
  static getStats(): { size: number; entries: Array<{ key: string; age: number; ttl: number }> } {
    try {
      return CacheService.getInstance().getStats();
    } catch (error) {
      logger.error('Cache stats error', {}, error as Error);
      return { size: 0, entries: [] };
    }
  }

  static destroy(): void {
    if (CacheService.instance) {
      CacheService.instance.destroy();
      CacheService.instance = null;
    }
  }
}

// Export singleton instance for easy access
export const cacheService = CacheService;