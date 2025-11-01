/**
 * @jest-environment node
 */

/**
 * Unit tests for cache adapters
 */

import { InMemoryCacheAdapter } from '../../src/lib/cache/memory-cache-adapter';
import { createCacheAdapter, resetGlobalCache, getCacheAdapter } from '../../src/lib/cache/cache-factory';

describe('InMemoryCacheAdapter', () => {
  let cache: InMemoryCacheAdapter;

  beforeEach(() => {
    cache = new InMemoryCacheAdapter(10); // Small capacity for testing
  });

  afterEach(async () => {
    await cache.clear();
  });

  it('should store and retrieve values', async () => {
    await cache.set('key1', 'value1');
    const result = await cache.get<string>('key1');
    expect(result).toBe('value1');
  });

  it('should return undefined for missing keys', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should handle TTL expiration', async () => {
    await cache.set('key1', 'value1', 100); // 100ms TTL
    const immediate = await cache.get('key1');
    expect(immediate).toBe('value1');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    const expired = await cache.get('key1');
    expect(expired).toBeUndefined();
  });

  it('should implement LRU eviction', async () => {
    // Fill cache to capacity
    for (let i = 0; i < 10; i++) {
      await cache.set(`key${i}`, `value${i}`);
    }

    const stats = await cache.stats();
    expect(stats.size).toBe(10);

    // Add one more, should evict oldest
    await cache.set('key10', 'value10');
    const stats2 = await cache.stats();
    expect(stats2.size).toBe(10);

    // First key should be evicted
    const evicted = await cache.get('key0');
    expect(evicted).toBeUndefined();

    // Newest key should exist
    const newest = await cache.get('key10');
    expect(newest).toBe('value10');
  });

  it('should delete specific keys', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');

    await cache.delete('key1');
    
    expect(await cache.get('key1')).toBeUndefined();
    expect(await cache.get('key2')).toBe('value2');
  });

  it('should clear all entries', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');

    await cache.clear();

    expect(await cache.get('key1')).toBeUndefined();
    expect(await cache.get('key2')).toBeUndefined();
    
    const stats = await cache.stats();
    expect(stats.size).toBe(0);
  });

  it('should track hits and misses', async () => {
    await cache.set('key1', 'value1');

    await cache.get('key1'); // hit
    await cache.get('key2'); // miss
    await cache.get('key1'); // hit

    const stats = await cache.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });

  it('should handle complex objects', async () => {
    const obj = { name: 'test', nested: { value: 123 } };
    await cache.set('obj', obj);

    const result = await cache.get<typeof obj>('obj');
    expect(result).toEqual(obj);
  });

  it('should maintain LRU order on set', async () => {
    // Fill cache to capacity (10 items)
    for (let i = 1; i <= 10; i++) {
      await cache.set(`key${i}`, `value${i}`);
    }

    // Update key1 to move it to end
    await cache.set('key1', 'value1-updated');

    // Add 3 more items, should evict key2, key3, key4 (oldest after key1 was moved)
    await cache.set('key11', 'value11');
    await cache.set('key12', 'value12');
    await cache.set('key13', 'value13');

    // key1 should still exist (was moved to end via set)
    expect(await cache.get('key1')).toBe('value1-updated');
    
    // key2, key3, key4 should be evicted (oldest 3)
    expect(await cache.get('key2')).toBeUndefined();
    expect(await cache.get('key3')).toBeUndefined();
    expect(await cache.get('key4')).toBeUndefined();
    
    // Newest items should exist
    expect(await cache.get('key11')).toBe('value11');
    expect(await cache.get('key13')).toBe('value13');
  });
});

describe('Cache Factory', () => {
  beforeEach(() => {
    resetGlobalCache();
  });

  it('should create memory adapter by default', () => {
    const adapter = createCacheAdapter();
    expect(adapter).toBeInstanceOf(InMemoryCacheAdapter);
  });

  it('should create memory adapter when explicitly specified', () => {
    const adapter = createCacheAdapter('memory', { maxEntries: 100 });
    expect(adapter).toBeInstanceOf(InMemoryCacheAdapter);
  });

  it('should return singleton instance', () => {
    const adapter1 = getCacheAdapter();
    const adapter2 = getCacheAdapter();
    expect(adapter1).toBe(adapter2);
  });

  it('should create new instance after reset', () => {
    const adapter1 = getCacheAdapter();
    resetGlobalCache();
    const adapter2 = getCacheAdapter();
    expect(adapter1).not.toBe(adapter2);
  });

  it('should respect CACHE_ADAPTER env var', () => {
    const oldEnv = process.env.CACHE_ADAPTER;
    process.env.CACHE_ADAPTER = 'memory';
    
    const adapter = createCacheAdapter();
    expect(adapter).toBeInstanceOf(InMemoryCacheAdapter);
    
    if (oldEnv) {
      process.env.CACHE_ADAPTER = oldEnv;
    } else {
      delete process.env.CACHE_ADAPTER;
    }
  });
});
