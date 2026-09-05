import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pushToast, dismissToast, subscribeToasts, toast, clearToasts, ToastItem } from './toast';

describe('toast store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearToasts();  });

  it('pushToast 添加条目并通知订阅者', () => {
    const received: ToastItem[][] = [];
    const unsub = subscribeToasts((items) => received.push(items));
    pushToast('info', 'hello');
    expect(received.length).toBeGreaterThan(0);
    expect(received[received.length - 1].map((i) => i.message)).toContain('hello');
    unsub();
  });

  it('超时后自动移除', () => {
    const received: ToastItem[][] = [];
    subscribeToasts((items) => received.push(items));
    const id = pushToast('success', 'auto-dismiss', 1000);
    vi.advanceTimersByTime(1000);
    expect(received[received.length - 1].some((i) => i.id === id)).toBe(false);
  });

  it('dismissToast 立即移除并清理定时器', () => {
    const received: ToastItem[][] = [];
    subscribeToasts((items) => received.push(items));
    const id = pushToast('warning', 'manual', 5000);
    dismissToast(id);
    expect(received[received.length - 1]).toEqual([]);
    vi.advanceTimersByTime(5000);
    expect(received[received.length - 1]).toEqual([]);
  });

  it('超过 MAX_VISIBLE 时移除最早条目', () => {
    const received: ToastItem[][] = [];
    subscribeToasts((items) => received.push(items));
    for (let i = 1; i <= 7; i++) {
      toast.info(`msg-${i}`);
    }
    const latest = received[received.length - 1];
    expect(latest.length).toBeLessThanOrEqual(5);
    expect(latest.some((i) => i.message === 'msg-1')).toBe(false);
  });

  it('subscribeToasts 返回取消订阅函数', () => {
    const received: ToastItem[][] = [];
    const unsub = subscribeToasts((items) => received.push(items));
    unsub();
    pushToast('error', 'after-unsub');
    expect(received).toEqual([]);
  });
});
