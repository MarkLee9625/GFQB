/**
 * 全局注入的运行时变量声明（阅读器嵌入数据 / PDF.js / 非标准浏览器 API）。
 * 供 reader / useJournal / useAppInitialization / pdf wrapper 等使用，
 * 避免散落 (window as any) 与 @ts-ignore。
 */

interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

declare global {
  interface Window {
    /** 阅读器嵌入的文章数据（压缩后 Base64） */
    __SWS_DATA_ARTICLES_B64__?: string;
    /** 阅读器嵌入的配置数据（压缩后 Base64） */
    __SWS_DATA_CONFIG_B64__?: string;
    /** 嵌入数据压缩方式: none | gzip | deflate */
    __SWS_COMPRESSION_METHOD__?: string;
    /** v2 布局标记：'v2'（缺席即 v1 老文件） */
    __SWS_FORMAT__?: string;
    /** v2：meta 包（gzip+base64） */
    __SWS_V2_META_B64__?: string;
    /** v2：按篇 body 包（各 gzip+base64） */
    __SWS_V2_BODIES_B64__?: string[];
    /** v2：媒体表（`mime,b64` 单编码，不压缩） */
    __SWS_V2_MEDIA__?: string[];
    /** v2：压缩方式（与 __SWS_COMPRESSION_METHOD__ 同值，显式一份） */
    __SWS_V2_METHOD__?: string;
    /** PDF.js 库实例（构建后内联注入，post-build.js 约定 window.pdfjsLib） */
    pdfjsDist?: unknown;
    /** 页面内关键字查找（非标准，Chrome/Edge 原生实现） */
    find(keyword: string, caseSensitive?: boolean, backwards?: boolean, wrapAround?: boolean, wholeWord?: boolean, searchInFrames?: boolean, showDialog?: boolean): boolean;
  }

  interface Performance {
    /** Chrome 专有内存 API，仅开发环境监控使用 */
    memory?: PerformanceMemory;
  }
}

export {};
