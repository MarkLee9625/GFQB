import { describe, it, expect } from 'vitest';
import { gzipSync } from 'zlib';
import { parseEmbeddedData } from './embeddedData';

function b64OfBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

describe('parseEmbeddedData', () => {
  it('method=none 时按纯 JSON 解码', async () => {
    const json = JSON.stringify([{ id: 1, title: '测试' }]);
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    const data = await parseEmbeddedData<Array<{ id: number; title: string }>>(b64, 'none');
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe('测试');
  });

  it('method=gzip 时先解压再解析（导出端实际路径）', async () => {
    const json = JSON.stringify([{ id: 2, title: '压缩文章' }]);
    const gz = gzipSync(Buffer.from(json, 'utf8'));
    const b64 = b64OfBytes(new Uint8Array(gz));
    const data = await parseEmbeddedData<Array<{ id: number; title: string }>>(b64, 'gzip');
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe('压缩文章');
  });

  it('缺少数据时返回 null', async () => {
    const data = await parseEmbeddedData(undefined, 'gzip');
    expect(data).toBeNull();
  });

  it('损坏数据抛出异常而不是返回空结果', async () => {
    await expect(parseEmbeddedData('not-valid-base64!!', 'none')).rejects.toThrow();
  });
});