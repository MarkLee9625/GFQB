import { useCallback, useEffect } from 'react';
import { base64ToBlob } from '../src/utils/fileHelpers';

/**
 * 全局共享的 Blob URL 缓存和清理队列
 * 放在模块顶层以支持跨组件、跨 Hook 实例的缓存复用
 */
const globalBlobCache = new Map<string, { url: string; timestamp: number }>();
const MAX_CACHE_SIZE = 100;

const cleanupExpiredUrls = (): void => {
  const now = Date.now();
  const expiredTime = 5 * 60 * 1000;

  for (const [key, value] of globalBlobCache.entries()) {
    if (now - value.timestamp > expiredTime) {
      URL.revokeObjectURL(value.url);
      globalBlobCache.delete(key);
    }
  }

  if (globalBlobCache.size > MAX_CACHE_SIZE) {
    const entries = [...globalBlobCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const evictCount = globalBlobCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < evictCount; i++) {
      URL.revokeObjectURL(entries[i][1].url);
      globalBlobCache.delete(entries[i][0]);
    }
  }
};

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
let activeUserCount = 0;

function startCleanupTimer() {
  if (cleanupIntervalId !== null) return;
  cleanupIntervalId = setInterval(cleanupExpiredUrls, 60 * 1000);
}

function stopCleanupTimer() {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/* ==================== Worker 异步解码支持 ==================== */

interface PendingDecode {
  resolve: (blob: Blob) => void;
  reject: (error: unknown) => void;
}

interface WorkerDecodeResult {
  type: 'DECODE_RESULT';
  id: number;
  ok: boolean;
  blob?: Blob;
  error?: string;
}

let decodeWorker: Worker | null = null;
let nextDecodeId = 0;
const pendingDecodes = new Map<number, PendingDecode>();
// 同一 dataUrl 的进行中解码只发一次，后续调用等待同一 Promise
const decodePromiseCache = new Map<string, Promise<string | null>>();

function getDecodeWorker(): Worker | null {
  if (decodeWorker) return decodeWorker;
  if (typeof Worker === 'undefined') return null;
  try {
    decodeWorker = new Worker(
      new URL('../src/workers/base64ToBlob.worker.ts', import.meta.url),
      { type: 'module' }
    );
    decodeWorker.onmessage = (event: MessageEvent<WorkerDecodeResult>) => {
      const data = event.data;
      if (!data || data.type !== 'DECODE_RESULT') return;
      const pending = pendingDecodes.get(data.id);
      if (!pending) return;
      pendingDecodes.delete(data.id);
      if (data.ok && data.blob) {
        pending.resolve(data.blob);
      } else {
        pending.reject(new Error(data.error || 'base64 解码失败'));
      }
    };
    decodeWorker.onerror = (error) => {
      const err = new Error(error instanceof ErrorEvent ? error.message : '解码 Worker 异常');
      for (const [, pending] of pendingDecodes) {
        pending.reject(err);
      }
      pendingDecodes.clear();
      decodeWorker?.terminate();
      decodeWorker = null;
    };
    return decodeWorker;
  } catch (error) {
    console.error('创建解码 Worker 失败，回退主线程解码:', error);
    decodeWorker = null;
    return null;
  }
}

/** 主线程兜底：同步解码并写入全局缓存（Worker 不可用或失败时使用） */
function decodeToBlobUrlSync(dataUrl: string): string | null {
  try {
    const blob = base64ToBlob(dataUrl);
    if (blob.size === 0) return null;
    const url = URL.createObjectURL(blob);
    globalBlobCache.set(dataUrl, { url, timestamp: Date.now() });
    return url;
  } catch (error) {
    console.error('Failed to create blob URL:', error);
    return null;
  }
}

function decodeToBlobUrl(dataUrl: string): Promise<string | null> {
  // 命中已完成的 URL 缓存
  const cached = globalBlobCache.get(dataUrl);
  if (cached) {
    cached.timestamp = Date.now(); // 更新使用时间
    return Promise.resolve(cached.url);
  }

  const existing = decodePromiseCache.get(dataUrl);
  if (existing) return existing;

  const promise = new Promise<string | null>((resolve) => {
    const worker = getDecodeWorker();
    if (!worker) {
      resolve(decodeToBlobUrlSync(dataUrl));
      return;
    }

    const id = nextDecodeId++;
    pendingDecodes.set(id, {
      resolve: (blob) => {
        try {
          if (blob.size === 0) {
            resolve(null);
            return;
          }
          const url = URL.createObjectURL(blob);
          globalBlobCache.set(dataUrl, { url, timestamp: Date.now() });
          resolve(url);
        } catch (error) {
          console.error('Failed to create blob URL:', error);
          resolve(null);
        }
      },
      reject: () => {
        // Worker 报告失败时回退主线程同步解码一次，保证行为不劣化
        resolve(decodeToBlobUrlSync(dataUrl));
      },
    });
    worker.postMessage({ type: 'DECODE', id, dataUrl });
  });

  decodePromiseCache.set(dataUrl, promise);
  promise
    .finally(() => {
      decodePromiseCache.delete(dataUrl);
    })
    .catch(() => {
      // 已在上层 resolve(null)，不会走到这里；仅为类型完整性保留
    });
  return promise;
}

/**
 * 优化Blob URL管理的自定义Hook
 * 避免重复创建Blob URL，防止内存泄漏
 */
export function useBlobManager() {
  useEffect(() => {
    activeUserCount++;
    startCleanupTimer();
    return () => {
      activeUserCount--;
      if (activeUserCount <= 0) {
        activeUserCount = 0;
        stopCleanupTimer();
      }
    };
  }, []);

  // 创建或获取缓存的Blob URL
  const getBlobUrl = useCallback((dataUrl: string | null | undefined): string | null => {
    if (!dataUrl) return null;

    // 如果不是data URL，直接返回
    if (!dataUrl.startsWith('data:')) {
      return dataUrl;
    }

    // 检查缓存
    const cached = globalBlobCache.get(dataUrl);
    if (cached) {
      cached.timestamp = Date.now(); // 更新使用时间
      return cached.url;
    }

    try {
      // 创建新的Blob URL
      const blob = base64ToBlob(dataUrl);
      if (blob.size === 0) return null;

      const url = URL.createObjectURL(blob);
      globalBlobCache.set(dataUrl, { url, timestamp: Date.now() });

      return url;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      return null;
    }
  }, []);

  // 异步创建或获取缓存的Blob URL（Worker 解码，不阻塞主线程）
  const getBlobUrlAsync = useCallback((dataUrl: string | null | undefined): Promise<string | null> => {
    if (!dataUrl) return Promise.resolve(null);
    // 如果不是 data URL，直接返回
    if (!dataUrl.startsWith('data:')) {
      return Promise.resolve(dataUrl);
    }
    return decodeToBlobUrl(dataUrl);
  }, []);

  // 手动清理特定Blob URL
  const revokeBlobUrl = useCallback((dataUrl: string): void => {
    const cached = globalBlobCache.get(dataUrl);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      globalBlobCache.delete(dataUrl);
    }
    decodePromiseCache.delete(dataUrl);
  }, []);

  // 清理所有Blob URL
  const cleanupAll = useCallback(() => {
    for (const value of globalBlobCache.values()) {
      URL.revokeObjectURL(value.url);
    }
    globalBlobCache.clear();
    decodePromiseCache.clear();
    // 这里我们不直接弹出全局队列，而是由管理器统一维护
  }, []);

  return {
    getBlobUrl,
    getBlobUrlAsync,
    revokeBlobUrl,
    cleanupAll,
    getCacheSize: (): number => globalBlobCache.size,
  };
}
