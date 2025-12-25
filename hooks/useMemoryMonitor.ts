import { useEffect, useRef } from 'react';

/**
 * 内存监控Hook，用于检测JavaScript堆内存使用情况
 * 仅在Chrome浏览器中有效，用于开发环境监控
 * @param thresholdMB 内存使用警告阈值（MB），默认100MB
 */
export function useMemoryMonitor(thresholdMB = 100) {
  const lastWarningTime = useRef(0);

  useEffect(() => {
    // 仅当performance.memory存在时（Chrome）
    if (!('memory' in performance)) {
      console.warn('当前浏览器不支持performance.memory API，内存监控不可用');
      return;
    }

    const interval = setInterval(() => {
      // @ts-ignore
      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
      const usedMB = usedJSHeapSize / 1024 / 1024;
      const limitMB = jsHeapSizeLimit / 1024 / 1024;
      const percentage = (usedMB / limitMB) * 100;

      // 如果使用率超过80%或使用量超过阈值，发出警告
      if (percentage > 80 || usedMB > thresholdMB) {
        const now = Date.now();
        // 最多每30秒警告一次
        if (now - lastWarningTime.current > 30000) {
          lastWarningTime.current = now;
          console.warn(`[内存监控] 内存使用过高：${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB (${percentage.toFixed(1)}%)`);
          // 可以在这里触发清理操作，例如清理缓存
        }
      }
    }, 10000); // 每10秒检查一次

    return () => clearInterval(interval);
  }, [thresholdMB]);
}
