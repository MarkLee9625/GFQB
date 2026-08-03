/**
 * base64 → Blob 解码 Web Worker
 *
 * 职责：把 data URL 的 base64 部分解码成 Blob，避免大体积（图片/PDF）
 * 的 atob + 字节拷贝阻塞主线程。Worker 内不访问 DOM。
 */

interface DecodeRequest {
  type: 'DECODE';
  id: number;
  dataUrl: string;
}

interface DecodeResponse {
  type: 'DECODE_RESULT';
  id: number;
  ok: boolean;
  blob?: Blob;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null;
  postMessage: (message: DecodeResponse) => void;
};

ctx.onmessage = (event: MessageEvent<DecodeRequest>) => {
  const { type, id, dataUrl } = event.data;
  if (type !== 'DECODE') return;

  const fail = (error: string): void => {
    ctx.postMessage({ type: 'DECODE_RESULT', id, ok: false, error });
  };

  try {
    const splitIndex = dataUrl.indexOf(',');
    if (splitIndex === -1) {
      fail('无效的 DataURI 格式');
      return;
    }

    const base64 = dataUrl.substring(splitIndex + 1).replace(/\s/g, '');
    if (!base64) {
      fail('base64 数据为空');
      return;
    }

    const byteString = atob(base64);
    const mimeMatch = dataUrl.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }

    ctx.postMessage({
      type: 'DECODE_RESULT',
      id,
      ok: true,
      blob: new Blob([bytes], { type: mimeType }),
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
};
