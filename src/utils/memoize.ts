/**
 * 通用模块级 LRU 缓存
 *
 * 用于缓存纯函数结果（净化、图谱校验、HTML 解析等），
 * 按输入字符串做键，容量超出时淘汰最久未使用项。
 */
export function createLruCache<V>(capacity: number): {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  clear(): void;
  readonly size: number;
} {
  const map = new Map<string, V>();

  return {
    get(key: string): V | undefined {
      const value = map.get(key);
      if (value === undefined) return undefined;
      // 访问后移到末尾（最近使用）
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key: string, value: V): void {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > capacity) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
    },
    has(key: string): boolean {
      return map.has(key);
    },
    clear(): void {
      map.clear();
    },
    get size(): number {
      return map.size;
    },
  };
}
