/**
 * AI Prompt Cache
 * 
 * Caches AI responses to reduce costs and improve performance.
 * Uses in-memory cache with LRU eviction strategy.
 */

import crypto from 'crypto';

interface CacheEntry {
  content: string;
  timestamp: number;
  hits: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export class AIPromptCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttlMs: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate cache key from messages
   */
  private generateKey(
    messages: Array<{ role: string; content: string }>,
    model: string,
    temperature: number
  ): string {
    const content = JSON.stringify({ messages, model, temperature });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached response if available
   */
  get(
    messages: Array<{ role: string; content: string }>,
    model: string,
    temperature: number
  ): CacheEntry | null {
    const key = this.generateKey(messages, model, temperature);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    this.cache.set(key, entry);

    return entry;
  }

  /**
   * Store response in cache
   */
  set(
    messages: Array<{ role: string; content: string }>,
    model: string,
    temperature: number,
    content: string,
    promptTokens: number,
    completionTokens: number,
    costUsd: number
  ): void {
    const key = this.generateKey(messages, model, temperature);

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      content,
      timestamp: Date.now(),
      hits: 0,
      promptTokens,
      completionTokens,
      costUsd,
    };

    this.cache.set(key, entry);
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    totalHits: number;
    totalSavings: number;
    entries: Array<{
      hits: number;
      age: number;
      savings: number;
    }>;
  } {
    const now = Date.now();
    let totalHits = 0;
    let totalSavings = 0;

    const entries = Array.from(this.cache.values()).map((entry) => {
      totalHits += entry.hits;
      const savings = entry.hits * entry.costUsd;
      totalSavings += savings;

      return {
        hits: entry.hits,
        age: Math.floor((now - entry.timestamp) / 1000 / 60), // age in minutes
        savings,
      };
    });

    return {
      size: this.cache.size,
      totalHits,
      totalSavings,
      entries: entries.sort((a, b) => b.hits - a.hits),
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
export const aiPromptCache = new AIPromptCache(1000, 60);

// Cleanup expired entries every 5 minutes
setInterval(() => {
  aiPromptCache.cleanup();
}, 5 * 60 * 1000);
