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

import { compressData, countLargePngs, uint8ArrayToBase64 } from './compression';
import { buildV2InjectionScript, buildV2Manifest } from './v2format';

export type ReaderExportFormat = 'v1' | 'v2';

interface WorkerRequest {
  type: 'START_EXPORT';
  /** 文章 JSON 文本（主线程已 stringify，R-D0 去重后） */
  articlesBlob: Blob;
  options: {
    useAlternateDesign?: boolean;
    includeImages?: boolean;
    /** v2 = 索引+按篇分块（生产模板）；v1 = 整包（降级骨架/兼容），缺省 v2 */
    format?: ReaderExportFormat;
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
    const format: ReaderExportFormat = options.format ?? 'v2';
    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 10, message: '读取文章数据...' });

    let rawArticlesJson: string | null = await articlesBlob.text();

    // R2 守卫：大 PNG 计数（照片类 PNG 应走 WebP；第3期基线为 0）
    const pngGuard = countLargePngs(rawArticlesJson);

    const configJson = JSON.stringify({
      company: companyInfo,
      version: '1.0.0',
      alternateDesign: options.useAlternateDesign ?? false,
      logo: metadata.logo || '',
      sidebarMeta: metadata.sidebarMeta || ''
    });
    const configResult = await compressData(configJson, 'gzip');
    const configB64 = uint8ArrayToBase64(configResult.data);
    const base = {
      type: 'EXPORT_COMPLETE' as const,
      configB64,
      pngLargeCount: pngGuard.count,
      pngLargeBytes: pngGuard.binBytes,
    };

    if (format === 'v1') {
      self.postMessage({ type: 'EXPORT_PROGRESS', percent: 50, message: '数据读取完成，开始压缩...' });
      const articlesResult = await compressData(rawArticlesJson, 'gzip');
      const articlesB64 = uint8ArrayToBase64(articlesResult.data);
      const compressionMethod = articlesResult.method === 'none' && configResult.method === 'none'
        ? 'none'
        : articlesResult.method;
      self.postMessage({ type: 'EXPORT_PROGRESS', percent: 90, message: '压缩完成，准备返回...' });
      self.postMessage({ ...base, format: 'v1' as const, articlesB64, compressionMethod });
      return;
    }

    // v2：索引 + 按篇分块 + 媒体单编码（解析与分块全在 Worker 内，主线程零大对象）
    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 20, message: '解析文章并抽取媒体...' });
    const articles = JSON.parse(rawArticlesJson);
    rawArticlesJson = null;
    const manifest = buildV2Manifest(articles);

    const metaResult = await compressData(JSON.stringify(manifest.shells), 'gzip');
    const metaB64 = uint8ArrayToBase64(metaResult.data);

    const bodiesB64: string[] = [];
    let bodyMethod: 'gzip' | 'deflate' | 'none' = metaResult.method;
    for (let i = 0; i < manifest.bodyJsons.length; i++) {
      const c = await compressData(manifest.bodyJsons[i], 'gzip');
      if (c.method === 'none') bodyMethod = 'none';
      bodiesB64.push(uint8ArrayToBase64(c.data));
      const pct = 20 + Math.round(((i + 1) / manifest.bodyJsons.length) * 65);
      self.postMessage({ type: 'EXPORT_PROGRESS', percent: pct, message: `压缩正文 ${i + 1}/${manifest.bodyJsons.length}...` });
      // 释放已压缩的原文，降低 Worker 内存峰值
      manifest.bodyJsons[i] = '';
    }

    const compressionMethod = metaResult.method === 'none' && bodyMethod === 'none' && configResult.method === 'none'
      ? 'none'
      : 'gzip';
    self.postMessage({ type: 'EXPORT_PROGRESS', percent: 95, message: '压缩完成，准备返回...' });
    // 注入脚本在 Worker 内拼好：100MB 级数组只在 Worker 侧驻留，主线程只做一次模板替换
    const injectionScript = buildV2InjectionScript({
      metaB64,
      bodiesB64,
      media: manifest.media,
      configB64,
      compressionMethod,
    });
    self.postMessage({
      ...base,
      format: 'v2' as const,
      injectionScript,
      compressionMethod,
    });
  } catch (error) {
    self.postMessage({ type: 'EXPORT_ERROR', error: String(error) });
  }
};
