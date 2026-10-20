/**
 * 单文件阅读版嵌入数据解析
 *
 * 导出端（src/services/export/reader.worker.ts + compression.ts）恒使用 gzip 压缩，
 * 加载端必须按 __SWS_COMPRESSION_METHOD__ 先解压再 JSON.parse。
 * 解压优先放在 Worker 中执行，避免几十 MB 数据在主页面上 atob/解压导致冻结；
 * Worker 或 DecompressionStream 不可用时回退主线程解压。
 */
import { decodeB64Utf8 } from './encoding';
import { restoreV2Article, type ArticleShell } from '../services/export/v2format';
import type { Article } from '../types';

export type EmbeddedCompressionMethod = 'none' | 'gzip' | 'deflate';

const DECOMPRESS_WORKER_SOURCE = [
  'self.onmessage = async function (e) {',
  '  try {',
  '    var b64 = e.data.b64;',
  '    var method = e.data.method;',
  '    var bin = atob(b64);',
  '    var bytes = new Uint8Array(bin.length);',
  '    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);',
  '    var ds = new DecompressionStream(method);',
  '    var rs = new ReadableStream({ start: function (c) { c.enqueue(bytes); c.close(); } });',
  '    var pipe = rs.pipeThrough(ds);',
  '    var rd = pipe.getReader();',
  '    var chunks = [];',
  '    var size = 0;',
  '    while (true) {',
  '      var r = await rd.read();',
  '      if (r.done) break;',
  '      chunks.push(r.value);',
  '      size += r.value.length;',
  '    }',
  '    var out = new Uint8Array(size);',
  '    var off = 0;',
  '    for (var j = 0; j < chunks.length; j++) { out.set(chunks[j], off); off += chunks[j].length; }',
  '    self.postMessage({ ok: true, text: new TextDecoder().decode(out) });',
  '  } catch (err) {',
  '    self.postMessage({ ok: false, error: String((err && err.message) || err) });',
  '  }',
  '};',
].join('\n');

function decompressInWorker(b64: string, method: 'gzip' | 'deflate'): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([DECOMPRESS_WORKER_SOURCE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      const timer = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(url);
        reject(new Error('解压超时'));
      }, 120000);

      worker.onmessage = (ev: MessageEvent) => {
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(url);
        const msg = ev.data;
        if (msg && msg.ok === true) {
          resolve(msg.text as string);
        } else {
          reject(new Error((msg && msg.error) || '解压失败'));
        }
      };
      worker.onerror = (err: ErrorEvent) => {
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(url);
        reject(new Error(err.message || 'Worker 解压失败'));
      };
      worker.postMessage({ b64, method });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

async function decompressDirect(b64: string, method: 'gzip' | 'deflate'): Promise<string> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ds = new DecompressionStream(method);
  const rs = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = rs.pipeThrough(ds).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    chunks.push(r.value);
    size += r.value.length;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

/** 读取当前页面注入的压缩方式（缺省视为未压缩） */
export function getEmbeddedCompressionMethod(): EmbeddedCompressionMethod {
  const w = typeof window !== 'undefined' ? window : (globalThis as unknown as Window);
  const m = w?.__SWS_COMPRESSION_METHOD__;
  return m === 'gzip' || m === 'deflate' ? m : 'none';
}

/**
 * 解析阅读版嵌入的 Base64 数据。
 * - method 为 none / 缺省时按纯 JSON 解码；
 * - method 为 gzip / deflate 时先解压再 JSON.parse。
 * 返回 null 表示没有数据；解析失败会抛出异常。
 */
export async function parseEmbeddedData<T>(
  b64: string | null | undefined,
  method?: EmbeddedCompressionMethod | string | null
): Promise<T | null> {
  if (!b64) return null;
  const m: EmbeddedCompressionMethod =
    method === 'gzip' || method === 'deflate' ? method : 'none';

  if (m === 'none') {
    return JSON.parse(decodeB64Utf8(b64)) as T;
  }

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 DecompressionStream，无法解压阅读版数据');
  }

  try {
    if (typeof Worker !== 'undefined') {
      const text = await decompressInWorker(b64, m);
      return JSON.parse(text) as T;
    }
  } catch (workerErr) {
    console.warn('[embeddedData] Worker 解压失败，回退主线程解压', workerErr);
  }

  const text = await decompressDirect(b64, m);
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// v2 布局 loader（R1-b/R3）：meta 秒开骨架 → body 按篇懒解码 → 媒体指针回填。
// v1 老文件无 v2 标记，调用方（reader.tsx）按 readV2Store 是否为 null 分流。
// ---------------------------------------------------------------------------

export interface V2Store {
  method: EmbeddedCompressionMethod;
  bodiesB64: string[];
  media: string[];
}

export interface V2Manifest extends V2Store {
  metaB64: string;
}

/** v2 存在性检查：标记 + 三段缺一即 null（走 v1 老路径） */
export function readV2Store(): V2Manifest | null {
  const w = typeof window !== 'undefined' ? window : (globalThis as unknown as Window);
  if (w?.__SWS_FORMAT__ !== 'v2') return null;
  const metaB64 = w?.__SWS_V2_META_B64__;
  const bodiesB64 = w?.__SWS_V2_BODIES_B64__;
  const media = w?.__SWS_V2_MEDIA__;
  if (typeof metaB64 !== 'string' || !Array.isArray(bodiesB64) || !Array.isArray(media)) return null;
  const m = w?.__SWS_V2_METHOD__ ?? w?.__SWS_COMPRESSION_METHOD__;
  return { metaB64, bodiesB64, media, method: m === 'gzip' || m === 'deflate' ? m : 'none' };
}

/** 解码 meta（KB 级，主线程直接解即可） */
export async function parseV2Meta(metaB64: string, method: EmbeddedCompressionMethod): Promise<ArticleShell[]> {
  const text = method === 'none' ? decodeB64Utf8(metaB64) : await decompressDirect(metaB64, method);
  const shells = JSON.parse(text) as ArticleShell[];
  if (!Array.isArray(shells)) throw new Error('v2 meta 损坏');
  return shells;
}

/** body b64 超此长度走 Worker 解压（大篇主线程解压会冻结翻页） */
export const V2_WORKER_THRESHOLD = 256 * 1024;

async function gunzipText(b64: string, method: 'gzip' | 'deflate'): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 DecompressionStream，无法解压阅读版数据');
  }
  if (b64.length > V2_WORKER_THRESHOLD && typeof Worker !== 'undefined') {
    try {
      return await decompressInWorker(b64, method);
    } catch (workerErr) {
      console.warn('[embeddedData] Worker 解压失败，回退主线程解压', workerErr);
    }
  }
  return decompressDirect(b64, method);
}

export interface V2BodyLoader {
  loadBody: (idx: number) => Promise<Article>;
  cachedCount: () => number;
  /** 索引干净完成（无失败）后释放媒体表；失败重试前不得调用 */
  releaseMedia: () => void;
}

/**
 * 按篇 loader：缓存 + 在途去重（翻页与后台索引并发时同篇只解一次）。
 * @param shells 外壳数组（与 bodies 下标对齐；解码后断言 id 一致，防未来错位）
 * 内存：单篇缓存成功即清空其 b64（失败保留供重试）；媒体表由 releaseMedia 在
 * 索引干净完成时整体释放（失败篇重试前保留）。
 */
export function createV2BodyLoader(store: V2Store, shells: ArticleShell[]): V2BodyLoader {
  const cache = new Map<number, Article>();
  const inflight = new Map<number, Promise<Article>>();

  async function loadBody(idx: number): Promise<Article> {
    const hit = cache.get(idx);
    if (hit) return hit;
    const running = inflight.get(idx);
    if (running) return running;
    const p = (async () => {
      try {
        const b64 = store.bodiesB64[idx];
        if (typeof b64 !== 'string' || b64 === '') throw new Error(`v2 body 缺失: ${idx}`);
        const text = store.method === 'none' ? decodeB64Utf8(b64) : await gunzipText(b64, store.method);
        const article = restoreV2Article(text, store.media);
        const expectedId = shells[idx]?.id;
        if (expectedId === undefined || article.id !== expectedId) {
          throw new Error(`[v2] 下标错位: bodies[${idx}].id=${article.id} ≠ shells[${idx}].id=${expectedId}`);
        }
        cache.set(idx, article);
        store.bodiesB64[idx] = '';
        return article;
      } finally {
        inflight.delete(idx);
      }
    })();
    inflight.set(idx, p);
    return p;
  }

  return {
    loadBody,
    cachedCount: () => cache.size,
    releaseMedia: () => {
      store.media.length = 0;
    },
  };
}

