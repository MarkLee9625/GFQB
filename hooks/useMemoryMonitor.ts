import { useEffect, useRef } from 'react';
import { toast } from '../src/utils/toast';

function appendMemLog(entry: { t: number; usedMB: number; limitMB: number; pct: number; warn: boolean }) {
  try {
    const key = 'SWS_MEM_LOG';
    const raw = localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push(entry);
    // 环形保留最近50条，避免存储膨胀
    while (list.length > 50) list.shift();
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 私有模式等存储异常忽略，不影响主流程
  }
}

export function useMemoryMonitor(thresholdMB = 100) {
  const lastWarningTime = useRef(0);

  useEffect(() => {
    if (!('memory' in performance)) {
      return;
    }

    // 开发10s、生产30s采样，避免后台标签频繁唤醒
    const intervalMs = import.meta.env.DEV ? 10000 : 30000;
    const interval = setInterval(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (!mem) return;
      const { usedJSHeapSize, jsHeapSizeLimit } = mem;
      const usedMB = usedJSHeapSize / 1024 / 1024;
      const limitMB = jsHeapSizeLimit / 1024 / 1024;
      const percentage = (usedMB / limitMB) * 100;

      if (percentage > 80 || usedMB > thresholdMB) {
        const now = Date.now();
        appendMemLog({ t: now, usedMB: Math.round(usedMB * 100) / 100, limitMB: Math.round(limitMB * 100) / 100, pct: Math.round(percentage * 10) / 10, warn: true });
        if (now - lastWarningTime.current > 30000) {
          lastWarningTime.current = now;
          console.warn(`[内存监控] 内存使用过高：${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB (${percentage.toFixed(1)}%)`);
          toast.warning(`内存占用较高（${usedMB.toFixed(0)}MB），建议保存后刷新页面`);
        }
      } else if (Math.random() < 0.01) {
        // 1%心跳采样，用于事后趋势排查，不打扰用户
        appendMemLog({ t: Date.now(), usedMB: Math.round(usedMB * 100) / 100, limitMB: Math.round(limitMB * 100) / 100, pct: Math.round(percentage * 10) / 10, warn: false });
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [thresholdMB]);
}
