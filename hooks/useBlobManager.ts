import { useRef, useEffect } from 'react';

/**
 * 优化Blob URL管理的自定义Hook
 * 避免重复创建Blob URL，防止内存泄漏
 */
export function useBlobManager() {
  const blobUrlCache = useRef<Map<string, { url: string; timestamp: number }>>(new Map());
  const cleanupRef = useRef<Array<() => void>>([]);

  // 清理过期的Blob URL（超过5分钟）
  const cleanupExpiredUrls = (): void => {
    const now = Date.now();
    const expiredTime = 5 * 60 * 1000; // 5分钟

    for (const [key, value] of blobUrlCache.current.entries()) {
      if (now - value.timestamp > expiredTime) {
        URL.revokeObjectURL(value.url);
        blobUrlCache.current.delete(key);
      }
    }
  };

  // 创建或获取缓存的Blob URL
  const getBlobUrl = (dataUrl: string | null | undefined): string | null => {
    if (!dataUrl) return null;

    // 如果不是data URL，直接返回
    if (!dataUrl.startsWith('data:')) {
      return dataUrl;
    }

    // 检查缓存
    const cached = blobUrlCache.current.get(dataUrl);
    if (cached) {
      cached.timestamp = Date.now(); // 更新使用时间
      return cached.url;
    }

    try {
      // 创建新的Blob URL
      const blob = base64ToBlob(dataUrl);
      if (blob.size === 0) return null;

      const url = URL.createObjectURL(blob);
      blobUrlCache.current.set(dataUrl, { url, timestamp: Date.now() });

      // 添加清理函数
      const cleanup = (): void => {
        URL.revokeObjectURL(url);
        blobUrlCache.current.delete(dataUrl);
      };
      cleanupRef.current.push(cleanup);

      return url;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      return null;
    }
  };

  // 手动清理特定Blob URL
  const revokeBlobUrl = (dataUrl: string): void => {
    const cached = blobUrlCache.current.get(dataUrl);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      blobUrlCache.current.delete(dataUrl);
    }
  };

  // 清理所有Blob URL
  const cleanupAll = (): void => {
    for (const value of blobUrlCache.current.values()) {
      URL.revokeObjectURL(value.url);
    }
    blobUrlCache.current.clear();
    cleanupRef.current.forEach(fn => fn());
    cleanupRef.current = [];
  };

  // 组件卸载时清理
  useEffect(() => {
    return (): void => {
      cleanupAll();
    };
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
    getCacheSize: (): number => blobUrlCache.current.size,
  };
}

// 辅助函数：将base64转换为Blob
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const byteString = atob(parts[1] || '');
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mime || 'application/octet-stream' });
}
