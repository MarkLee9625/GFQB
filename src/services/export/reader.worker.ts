/**
 * 阅读器导出 Web Worker
 *
 * 职责：
 * 1. 接收主线程传来的文章 JSON Blob（Blob 结构化克隆只按引用共享底层数据，无字节复制）
 * 2. 在 Worker 线程读取 JSON 文本并压缩
 * 3. 返回压缩后的 Base64 字符串
 *
 * 注意：Worker 内不能访问 DOM 和 window 对象。
 * 主线程不再 postMessage 整个对象图（避免同步深拷贝几十 MB 的 content/pdfData/base64 图），
 * 改为 JSON.stringify 一次 → Blob → postMessage(Blob)，克隆开销为 O(1)。
 */

import { compressData, uint8ArrayToBase64 } from './compression';

interface WorkerRequest {
  type: 'START_EXPORT';
  /** 文章 JSON 文本（主线程已 stringify，保留 blocks/pdfData 等全部字段） */
  articlesBlob: Blob;
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
  const { type, articlesBlob, options, metadata, companyInfo } = event.data;

  if (type !== 'START_EXPORT') return;

  try {
    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 10, message: '读取文章数据...' });

    const rawArticlesJson = await articlesBlob.text();

    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 50, message: '数据读取完成，开始压缩...' });

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
