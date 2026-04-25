/**
 * 阅读器导出 Web Worker
 *
 * 职责：
 * 1. 接收主线程传来的 articles 数组（已通过 optimizeStructuredClone 优化）
 * 2. 在 Worker 线程执行 JSON.stringify 序列化
 * 3. 在 Worker 线程执行 compressData 压缩
 * 4. 返回压缩后的 Base64 字符串
 *
 * 注意：Worker 内不能访问 DOM 和 window 对象
 */

import { compressData, uint8ArrayToBase64 } from './compression';

interface WorkerRequest {
  type: 'START_EXPORT';
  articles: any[];
  options: {
    useAlternateDesign?: boolean;
    includeImages?: boolean;
    optimizeForPrint?: boolean;
  };
  metadata: {
    logo?: string;
    sidebarMeta?: string;
    title?: string;
    date?: string;
  };
  companyInfo: {
    NAME: string;
    ADDRESS: string;
    PHONE: string;
    FAX: string;
    EMAIL: string;
    WEBSITE: string;
  };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, articles, options, metadata, companyInfo } = event.data;

  if (type !== 'START_EXPORT') return;

  try {
    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 10, message: '开始序列化...' });

    const rawArticlesJson = JSON.stringify(articles);

    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 50, message: '序列化完成，开始压缩...' });

    const articlesResult = await compressData(rawArticlesJson, 'gzip');
    const articlesB64 = uint8ArrayToBase64(articlesResult.data);

    const configJson = JSON.stringify({
      company: companyInfo,
      version: '1.0.0',
      alternateDesign: options.useAlternateDesign ?? false,
      logo: metadata.logo || '',
      sidebarMeta: metadata.sidebarMeta || ''
    });
    const configResult = await compressData(configJson, 'gzip');
    const configB64 = uint8ArrayToBase64(configResult.data);

    const compressionMethod = articlesResult.method === 'none' && configResult.method === 'none'
      ? 'none'
      : articlesResult.method;

    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 90, message: '压缩完成，准备返回...' });

    self.postMessage({
      type: 'EXPORT_COMPLETE',
      articlesB64,
      configB64,
      compressionMethod
    });

  } catch (error) {
    self.postMessage({ type: 'EXPORT_ERROR', error: String(error) });
  }
};
