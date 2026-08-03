import { describe, it, expect } from 'vitest';
import { createLruCache } from './memoize';

describe('createLruCache', () => {
  it('缓存命中并按最近使用顺序淘汰', () => {
    const cache = createLruCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBe(1); // a 变为最近使用
    cache.set('d', 4); // 超出容量，应淘汰最久未使用的 b
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('缓存 false/空字符串等假值', () => {
    const cache = createLruCache<boolean>(2);
    cache.set('no', false);
    expect(cache.get('no')).toBe(false);
    expect(cache.has('no')).toBe(true);
  });

  it('clear 清空全部', () => {
    const cache = createLruCache<string>(5);
    cache.set('x', '1');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('x')).toBeUndefined();
  });
});
