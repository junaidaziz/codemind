/**
 * In-Memory Cache Adapter
 * Implements CacheAdapter with TTL and LRU eviction
 */

import { CacheAdapter, CacheEntry } from './cache-adapter';

export class InMemoryCacheAdapter implements CacheAdapter {
  private cache: Map<string, CacheEntry<unknown>>;
  private readonly maxEntries: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxEntries: number = 500) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    // Default TTL: 5 minutes
    const expiresAt = Date.now() + (ttlMs ?? 300_000);
    
    // LRU eviction if at capacity and key doesn't exist
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // If key exists, delete it first to move to end (LRU)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async stats(): Promise<{ size: number; hits: number; misses: number }> {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
