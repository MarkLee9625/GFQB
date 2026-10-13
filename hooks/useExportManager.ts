import { useCallback, useRef, useEffect } from 'react';
import type { Article } from '../src/types';
import { generatePrintableHTML, exportReaderHTML } from '../src/services/export';
import { toast } from '../src/utils/toast';
import { resolveArticlesMediaData, findMissingMediaHashes } from '../services/mediaStore';

interface UseExportManagerOptions {
  articles: Article[];
  logo: string;
  sidebarMeta: string;
  openExportOptionsModal: () => void;
}

export function useExportManager({
  articles,
  logo,
  sidebarMeta,
  openExportOptionsModal,
}: UseExportManagerOptions) {
  const exportBlobUrls = useRef<string[]>([]);
  const exportTimers = useRef<NodeJS.Timeout[]>([]);

  const addTemporaryBlobUrl = useCallback((url: string) => {
    exportBlobUrls.current.push(url);
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      exportBlobUrls.current = exportBlobUrls.current.filter(u => u !== url);
      const index = exportTimers.current.indexOf(timer);
      if (index > -1) {
        exportTimers.current.splice(index, 1);
      }
    }, 5 * 60 * 1000);
    exportTimers.current.push(timer);
  }, []);

  const cleanupTemporaryBlobUrls = useCallback(() => {
    exportBlobUrls.current.forEach(url => URL.revokeObjectURL(url));
    exportBlobUrls.current = [];
    exportTimers.current.forEach(timer => clearTimeout(timer));
    exportTimers.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupTemporaryBlobUrls();
    };
  }, [cleanupTemporaryBlobUrls]);

  const createExportBlob = useCallback((content: string) => {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    addTemporaryBlobUrl(url);
    return url;
  }, [addTemporaryBlobUrl]);

  const handleExportWithOptions = useCallback(async (
    options: {
      useAlternateDesign: boolean;
      includeImages: boolean;
      exportType: 'reader' | 'printable';
    },
    onProgress?: (percent: number, message?: string) => void
  ) => {
    // 打印版要开新窗口：必须在**第一个 await 之前**打开，保留用户手势
    // （Chrome 的瞬时激活窗口约 5s，媒体还原耗时可能超过它 ⇒ 否则必被弹窗拦截）
    const printWindow = options.exportType === 'printable' ? window.open('', '_blank') : null;
    if (options.exportType === 'printable' && !printWindow) {
      toast.error('弹窗被浏览器拦截，请允许此站点弹出窗口后重试。');
      return;
    }
    try {
      // P0-A：导出产物必须自包含 —— 先把 sws-media:// 引用还原为 data URL，再交给导出引擎
      const resolvedArticles = await resolveArticlesMediaData(articles);
      // 悬空引用告警：媒体缺失时引擎只能原样保留引用，必须让用户知情（生产构建 drop console）
      const missing = await findMissingMediaHashes(resolvedArticles);
      if (missing.length > 0) {
        toast.warning(`有 ${missing.length} 项媒体在本地缺失，导出产物中对应位置将无法显示`);
      }
      if (options.exportType === 'reader') {
        await exportReaderHTML(resolvedArticles, options, { logo, sidebarMeta }, onProgress);
      } else {
        onProgress?.(0, '开始生成打印版...');
        const targetWindow = printWindow as Window;
        try {
          targetWindow.document.title = '正在生成打印版...';
          const pEl = targetWindow.document.createElement('p');
          pEl.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#999;font-size:14px;';
          pEl.textContent = '正在为您准备打印版，请稍候...';
          targetWindow.document.body.appendChild(pEl);

          const htmlContent = await generatePrintableHTML(
            resolvedArticles,
            options,
            { logo, sidebarMeta },
            (done, total) => {
              // 正文处理占 0–90%，打开预览占 90–100%
              const percent = total > 0 ? Math.round((done / total) * 90) : 0;
              onProgress?.(percent, total > 0 ? `正在处理第 ${done}/${total} 篇...` : '正在处理...');
            }
          );
          if (targetWindow.closed) {
            onProgress?.(90, '预览窗口已关闭');
            return;
          }
          onProgress?.(90, '正在打开预览...');
          const url = createExportBlob(htmlContent);
          targetWindow.location.href = url;
          onProgress?.(100, '打印版生成完成');
        } catch (err) {
          try { if (!targetWindow.closed) targetWindow.close(); } catch { /* 忽略关闭异常 */ }
          throw err;
        }
      }
    } catch (error) {
      console.error('导出失败:', error);
      // 错误已由 ExportOptionsModal 的 onConfirm catch 展示（弹窗内错误提示），
      // 此处不再 alert，避免重复反馈
      throw error;
    }
  }, [articles, logo, sidebarMeta, createExportBlob]);

  const handleExport = useCallback(async (isReader: boolean, categories?: string[]) => {
    if (isReader) {
      openExportOptionsModal();
      return;
    }

    // P0-A：项目文件是跨设备搬运的载体，引用只在本地库内有意义 → 导出前还原为 data URL
    const exportArticles = await resolveArticlesMediaData(articles);
    const safeArticles = JSON.stringify(exportArticles).replace(/-->/g, '--\\u003e');
    const safeCategories = JSON.stringify(categories || []).replace(/-->/g, '--\\u003e');
    const content = `<!-- DATA START ${safeArticles} DATA END -->` +
      `<!-- LOGO START ${logo} LOGO END -->` +
      `<!-- CAT START ${safeCategories} CAT END -->` +
      `<!-- META START ${sidebarMeta} META END -->`;
    const url = createExportBlob(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SWS_Project_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
  }, [articles, logo, sidebarMeta, createExportBlob, openExportOptionsModal]);

  return {
    handleExport,
    handleExportWithOptions,
  };
}
