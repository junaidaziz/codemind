/**
 * Redis Cache Adapter
 * Implements CacheAdapter with Redis/Vercel KV backend
 * Install: npm install @vercel/kv or ioredis
 */

import { CacheAdapter } from './cache-adapter';

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<string | null>;
  del(key: string): Promise<number>;
  flushdb(): Promise<string>;
  dbsize(): Promise<number>;
  quit(): Promise<string>;
}

export class RedisCacheAdapter implements CacheAdapter {
  private client: RedisClient | null = null;
  private connected: boolean = false;

  constructor(redisUrl?: string) {
    // Lazy initialization - only connect when needed
    if (typeof window === 'undefined') {
      this.initializeClient(redisUrl);
    }
  }

  private async initializeClient(redisUrl?: string): Promise<void> {
    try {
      // Try Vercel KV first (if available)
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
          const { createClient } = await import('@vercel/kv');
          this.client = createClient({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN,
          }) as RedisClient;
          this.connected = true;
          console.log('[RedisCacheAdapter] Connected to Vercel KV');
          return;
        } catch {
          console.warn('[RedisCacheAdapter] @vercel/kv not installed, trying ioredis...');
        }
      } 
      // Fallback to ioredis
      if (redisUrl || process.env.REDIS_URL) {
        try {
          const Redis = (await import('ioredis')).default;
          this.client = new Redis(redisUrl || process.env.REDIS_URL) as unknown as RedisClient;
          this.connected = true;
          console.log('[RedisCacheAdapter] Connected to Redis');
          return;
        } catch {
          console.warn('[RedisCacheAdapter] ioredis not installed');
        }
      }
      
      console.warn('[RedisCacheAdapter] No Redis configuration found or packages not installed, adapter disabled');
    } catch (error) {
      console.error('[RedisCacheAdapter] Failed to initialize:', error);
      this.connected = false;
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.connected || !this.client) return undefined;

    try {
      const data = await this.client.get(key);
      if (!data) return undefined;
      
      // Parse JSON value
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('[RedisCacheAdapter] Get error:', error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      const serialized = JSON.stringify(value);
      
      if (ttlMs) {
        // Set with expiration (PX = milliseconds)
        await this.client.set(key, serialized, 'PX', ttlMs);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.error('[RedisCacheAdapter] Set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error('[RedisCacheAdapter] Delete error:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      // Warning: FLUSHDB clears entire database, use with caution
      // In production, consider using a key pattern instead
      await this.client.flushdb();
    } catch (error) {
      console.error('[RedisCacheAdapter] Clear error:', error);
    }
  }

  async stats(): Promise<{ size: number; hits?: number; misses?: number }> {
    if (!this.connected || !this.client) {
      return { size: 0 };
    }

    try {
      const dbsize = await this.client.dbsize();
      return { size: dbsize };
    } catch (error) {
      console.error('[RedisCacheAdapter] Stats error:', error);
      return { size: 0 };
    }
  }

  /**
   * Close the Redis connection
   * Call this during application shutdown
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.client) {
      try {
        await this.client.quit();
        this.connected = false;
      } catch (error) {
        console.error('[RedisCacheAdapter] Disconnect error:', error);
      }
    }
  }
}
