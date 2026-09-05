/**
 * 全局 Toast 提示（轻量自研，无第三方依赖）
 *
 * 模块级 store，可在 hooks / service 等非组件上下文直接调用：
 *   toast.info / toast.success / toast.warning / toast.error(message)
 * ToastHost 组件负责订阅渲染与自动消失。
 */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const DEFAULT_DURATION_MS = 3500;
const MAX_VISIBLE = 5;

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function notify() {
  listeners.forEach((listener) => listener(items));
}

/** 订阅 Toast 列表变更，返回取消订阅函数（供 ToastHost useEffect 使用） */
export function subscribeToasts(listener: (items: ToastItem[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 手动移除指定 Toast（同时清理其自动消失定时器） */
export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  items = items.filter((item) => item.id !== id);
  notify();
}

/** 推入一条 Toast，返回其在列表中的 id */
export function pushToast(type: ToastType, message: string, durationMs: number = DEFAULT_DURATION_MS): number {
  const id = nextId++;
  items = [...items, { id, type, message }];

  // 超出可见上限时移除最早的条目（并清理其定时器）
  if (items.length > MAX_VISIBLE) {
    const overflow = items.slice(0, items.length - MAX_VISIBLE);
    overflow.forEach((item) => {
      const timer = timers.get(item.id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(item.id);
      }
    });
    items = items.slice(items.length - MAX_VISIBLE);
  }

  notify();

  if (durationMs > 0) {
    const timer = setTimeout(() => dismissToast(id), durationMs);
    timers.set(id, timer);
  }
  return id;
}


/** 清空所有 Toast（测试隔离 / 手动重置用） */
export function clearToasts() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  items = [];
  nextId = 1;
  notify();
}

export const toast = {
  info(message: string, durationMs?: number) {
    return pushToast('info', message, durationMs);
  },
  success(message: string, durationMs?: number) {
    return pushToast('success', message, durationMs);
  },
  warning(message: string, durationMs?: number) {
    return pushToast('warning', message, durationMs);
  },
  error(message: string, durationMs?: number) {
    return pushToast('error', message, durationMs);
  },
};
