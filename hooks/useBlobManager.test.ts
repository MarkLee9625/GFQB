import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBlobManager } from './useBlobManager';

describe('useBlobManager', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  afterEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreate as typeof URL.createObjectURL;
    URL.revokeObjectURL = originalRevoke as typeof URL.revokeObjectURL;
  });

  it('getBlobUrlAsync 对 data URL 返回可用 blob URL（无 Worker 时回退主线程）', async () => {
    // jsdom 无 Worker：走主线程同步兜底；URL.createObjectURL 需打桩
    URL.createObjectURL = vi.fn(() => 'blob:mock-url') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    const { result } = renderHook(() => useBlobManager());
    const dataUrl = 'data:text/plain;base64,' + btoa('hello');

    let url: string | null = null;
    await act(async () => {
      url = await result.current.getBlobUrlAsync(dataUrl);
    });
    expect(url).toBe('blob:mock-url');

    // 第二次调用命中全局缓存，返回同一 URL
    let url2: string | null = null;
    await act(async () => {
      url2 = await result.current.getBlobUrlAsync(dataUrl);
    });
    expect(url2).toBe('blob:mock-url');
  });

  it('getBlobUrlAsync 对普通 URL 原样返回', async () => {
    const { result } = renderHook(() => useBlobManager());
    let url: string | null = null;
    await act(async () => {
      url = await result.current.getBlobUrlAsync('https://example.com/a.jpg');
    });
    expect(url).toBe('https://example.com/a.jpg');
  });
});
