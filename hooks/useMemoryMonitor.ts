import { useEffect, useRef } from 'react';

export function useMemoryMonitor(thresholdMB = 100) {
  const lastWarningTime = useRef(0);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    if (!('memory' in performance)) {
      return;
    }

    const interval = setInterval(() => {
      // @ts-ignore
      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
      const usedMB = usedJSHeapSize / 1024 / 1024;
      const limitMB = jsHeapSizeLimit / 1024 / 1024;
      const percentage = (usedMB / limitMB) * 100;

      if (percentage > 80 || usedMB > thresholdMB) {
        const now = Date.now();
        if (now - lastWarningTime.current > 30000) {
          lastWarningTime.current = now;
          console.warn(`[内存监控] 内存使用过高：${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB (${percentage.toFixed(1)}%)`);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [thresholdMB]);
}
