import { describe, expect, it, vi } from 'vitest';
import { LRUWithTTL } from './lru';

describe('LRUWithTTL', () => {
  it('evicts the least recently used value and expires stale entries', () => {
    vi.useFakeTimers();
    const cache = new LRUWithTTL<string, number>({ max: 2, ttlMs: 1000 });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBeUndefined();
    vi.useRealTimers();
  });
});
