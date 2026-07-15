import { useCallback, useRef, useEffect } from 'react';
import type { Article } from '../src/types';
import { generateReaderHTML, generatePrintableHTML, exportToPdf, exportReaderHTML, PdfExportOptions } from '../src/services/export';

interface UseExportManagerOptions {
  articles: Article[];
  logo: string;
  sidebarMeta: string;
  useAlternateDesign: boolean;
  openExportOptionsModal: () => void;
}

export function useExportManager({
  articles,
  logo,
  sidebarMeta,
  useAlternateDesign,
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
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    addTemporaryBlobUrl(url);
    return url;
  }, [addTemporaryBlobUrl]);

  const handleExportWithOptions = useCallback(async (
    options: {
      useAlternateDesign: boolean;
      includeImages: boolean;
      optimizeForPrint: boolean;
      exportType: 'reader' | 'printable' | 'pdf';
    },
    onProgress?: (percent: number, message?: string) => void
  ) => {
    try {
      if (options.exportType === 'pdf') {
        onProgress?.(0, '开始生成 PDF...');
        const pdfOptions: PdfExportOptions = {
          useAlternateDesign: options.useAlternateDesign,
          includeImages: options.includeImages,
          optimizeForPrint: options.optimizeForPrint,
          logo
        };
        await exportToPdf(articles, pdfOptions);
        onProgress?.(100, 'PDF 生成完成');
      } else if (options.exportType === 'reader') {
        await exportReaderHTML(articles, options, { logo, sidebarMeta }, onProgress);
      } else {
        onProgress?.(0, '开始生成打印版...');
        // 在 await 之前立即打开空白窗口，保留用户手势，防止弹窗拦截
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          alert('弹窗被浏览器拦截，请允许此站点弹出窗口后重试。');
          return;
        }
        printWindow.document.title = '正在生成打印版...';
        const pEl = printWindow.document.createElement('p');
        pEl.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#999;font-size:14px;';
        pEl.textContent = '正在为您准备打印版，请稍候...';
        printWindow.document.body.appendChild(pEl);

        const htmlContent = await generatePrintableHTML(articles, options, { logo, sidebarMeta });
        onProgress?.(90, '正在打开预览...');
        const url = createExportBlob(htmlContent);
        printWindow.location.href = url;
        onProgress?.(100, '打印版生成完成');
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出过程中发生错误，请查看控制台。');
      throw error;
    }
  }, [articles, logo, sidebarMeta, createExportBlob]);

  const handleExport = useCallback((isReader: boolean, categories?: string[]) => {
    if (isReader) {
      openExportOptionsModal();
      return;
    }

    const safeArticles = JSON.stringify(articles).replace(/-->/g, '--\\u003e');
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
