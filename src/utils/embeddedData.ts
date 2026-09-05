/**
 * 单文件阅读版嵌入数据解析
 *
 * 导出端（src/services/export/reader.worker.ts + compression.ts）恒使用 gzip 压缩，
 * 加载端必须按 __SWS_COMPRESSION_METHOD__ 先解压再 JSON.parse。
 * 解压优先放在 Worker 中执行，避免几十 MB 数据在主页面上 atob/解压导致冻结；
 * Worker 或 DecompressionStream 不可用时回退主线程解压。
 */
import { decodeB64Utf8 } from './encoding';

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