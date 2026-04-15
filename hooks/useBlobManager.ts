import { useRef, useEffect, useCallback } from 'react';
import { base64ToBlob } from '../src/utils/fileHelpers';

/**
 * 全局共享的 Blob URL 缓存和清理队列
 * 放在模块顶层以支持跨组件、跨 Hook 实例的缓存复用
 */
const globalBlobCache = new Map<string, { url: string; timestamp: number }>();
const globalCleanupQueue: Array<() => void> = [];
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

/**
 * 优化Blob URL管理的自定义Hook
 * 避免重复创建Blob URL，防止内存泄漏
 */
export function useBlobManager() {

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

      // 添加到全局清理列表
      globalCleanupQueue.push(() => {
        URL.revokeObjectURL(url);
        globalBlobCache.delete(dataUrl);
      });

      return url;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      return null;
    }
  }, []);

  // 手动清理特定Blob URL
  const revokeBlobUrl = useCallback((dataUrl: string): void => {
    const cached = globalBlobCache.get(dataUrl);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      globalBlobCache.delete(dataUrl);
    }
  }, []);

  // 清理所有Blob URL
  const cleanupAll = useCallback(() => {
    for (const value of globalBlobCache.values()) {
      URL.revokeObjectURL(value.url);
    }
    globalBlobCache.clear();
    // 这里我们不直接弹出全局队列，而是由管理器统一维护
  }, []);

  // 组件卸载时不因单次生命周期清理全局缓存，交给定时清理
  useEffect(() => {
    // 移除原有的 cleanupAll 调用，因为缓存是全局共享的
    // 如果需要显式清理，可以在 App 层级调用提供的方法
  }, []);

  // 定期清理过期URL
  useEffect(() => {
    const interval = setInterval(cleanupExpiredUrls, 60 * 1000); // 每分钟检查一次
    return (): void => clearInterval(interval);
  }, []);

  return {
    getBlobUrl,
    revokeBlobUrl,
    cleanupAll,
    getCacheSize: (): number => globalBlobCache.size,
  };
}
