import { describe, it, expect } from 'vitest';
import { countLargePngs, PNG_GUARD_THRESHOLD_BYTES } from './compression';

describe('countLargePngs（R2 守卫）', () => {
  it('超阈 PNG 计数 + 体积估算', () => {
    const big = 'A'.repeat(Math.ceil((PNG_GUARD_THRESHOLD_BYTES * 4) / 3) + 100);
    const small = 'B'.repeat(1000);
    const json = JSON.stringify({
      a: `data:image/png;base64,${big}`,
      b: `data:image/png;base64,${small}`,
      c: 'data:image/webp;base64,' + 'C'.repeat(100000),
    });
    const r = countLargePngs(json);
    expect(r.count).toBe(1);
    expect(r.binBytes).toBeGreaterThan(PNG_GUARD_THRESHOLD_BYTES);
  });

  it('无 PNG 时为 0', () => {
    expect(countLargePngs(JSON.stringify({ a: 'data:image/webp;base64,AAA' }))).toEqual({
      count: 0,
      binBytes: 0,
    });
  });

  it('阈值可覆盖', () => {
    const json = JSON.stringify({ a: 'data:image/png;base64,' + 'A'.repeat(100) });
    expect(countLargePngs(json, 10).count).toBe(1);
    expect(countLargePngs(json, 10_000_000).count).toBe(0);
  });
});
