import { describe, it, expect, afterEach } from 'vitest';
import { gzipSync } from 'zlib';
import {
  createV2BodyLoader,
  parseEmbeddedData,
  parseV2Meta,
  readV2Store,
} from './embeddedData';

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

describe('readV2Store', () => {
  const W = window as unknown as Record<string, unknown>;
  afterEach(() => {
    delete W.__SWS_FORMAT__;
    delete W.__SWS_V2_META_B64__;
    delete W.__SWS_V2_BODIES_B64__;
    delete W.__SWS_V2_MEDIA__;
    delete W.__SWS_V2_METHOD__;
    delete W.__SWS_COMPRESSION_METHOD__;
  });

  it('无标记即 null（走 v1 老路径）', () => {
    expect(readV2Store()).toBeNull();
  });

  it('标记 + 三段齐全即命中', () => {
    W.__SWS_FORMAT__ = 'v2';
    W.__SWS_V2_META_B64__ = Buffer.from('[]', 'utf8').toString('base64');
    W.__SWS_V2_BODIES_B64__ = [];
    W.__SWS_V2_MEDIA__ = [];
    W.__SWS_V2_METHOD__ = 'gzip';
    const s = readV2Store();
    expect(s).not.toBeNull();
    expect(s?.method).toBe('gzip');
  });

  it('缺任一段即 null', () => {
    W.__SWS_FORMAT__ = 'v2';
    W.__SWS_V2_META_B64__ = Buffer.from('[]', 'utf8').toString('base64');
    W.__SWS_V2_BODIES_B64__ = [];
    // 缺 MEDIA
    expect(readV2Store()).toBeNull();
  });

  it('method 缺省为 none', () => {
    W.__SWS_FORMAT__ = 'v2';
    W.__SWS_V2_META_B64__ = Buffer.from('[]', 'utf8').toString('base64');
    W.__SWS_V2_BODIES_B64__ = [];
    W.__SWS_V2_MEDIA__ = [];
    expect(readV2Store()?.method).toBe('none');
  });
});

describe('parseV2Meta（none 路径）', () => {
  it('解码外壳数组', async () => {
    const b64 = Buffer.from(JSON.stringify([{ id: 1, title: 't', category: 'c', order: 0, hasPdf: false }]), 'utf8').toString('base64');
    const shells = await parseV2Meta(b64, 'none');
    expect(shells).toHaveLength(1);
    expect(shells[0].title).toBe('t');
  });

  it('非数组即抛错', async () => {
    const b64 = Buffer.from('{"a":1}', 'utf8').toString('base64');
    await expect(parseV2Meta(b64, 'none')).rejects.toThrow(/meta 损坏/);
  });
});

describe('createV2BodyLoader（none 路径）', () => {
  const IMG = 'A'.repeat(64);
  const bodyJson = JSON.stringify({
    id: 7,
    title: 't7',
    category: '工法',
    content: `<p>x</p><img src="__SWS_M2_0__">`,
    coverImage: '__SWS_M2_1__',
  });
  const shells = [{ id: 7, title: 't7', category: '工法', order: 0, hasPdf: false }];
  const makeStore = () => ({
    method: 'none' as const,
    bodiesB64: [Buffer.from(bodyJson, 'utf8').toString('base64')],
    media: [`image/webp,${IMG}`, `image/png,${IMG}`],
  });

  it('回填媒体并缓存（二次命中不重复解）', async () => {
    const loader = createV2BodyLoader(makeStore(), shells);
    const a1 = await loader.loadBody(0);
    expect(a1.content).toContain(`data:image/webp;base64,${IMG}`);
    expect(a1.coverImage).toBe(`data:image/png;base64,${IMG}`);
    expect(loader.cachedCount()).toBe(1);
    const a2 = await loader.loadBody(0);
    expect(a2).toBe(a1);
  });

  it('在途去重：并发同篇只解一次', async () => {
    const loader = createV2BodyLoader(makeStore(), shells);
    const [a, b] = await Promise.all([loader.loadBody(0), loader.loadBody(0)]);
    expect(a).toBe(b);
  });

  it('下标越界抛错', async () => {
    const loader = createV2BodyLoader(makeStore(), shells);
    await expect(loader.loadBody(3)).rejects.toThrow(/缺失/);
  });

  it('下标/id 错位即抛响亮错', async () => {
    const loader = createV2BodyLoader(makeStore(), [
      { id: 999, title: '错位', category: '工法', order: 0, hasPdf: false },
    ]);
    await expect(loader.loadBody(0)).rejects.toThrow(/错位/);
  });

  it('缓存成功即清空 b64（失败保留供重试）', async () => {
    const store = makeStore();
    const loader = createV2BodyLoader(store, shells);
    await loader.loadBody(0);
    expect(store.bodiesB64[0]).toBe('');
    // 清空后再次 loadBody 命中缓存，不报错
    await expect(loader.loadBody(0)).resolves.toBeDefined();
  });

  it('releaseMedia 清空媒体表', async () => {
    const store = makeStore();
    const loader = createV2BodyLoader(store, shells);
    await loader.loadBody(0);
    loader.releaseMedia();
    expect(store.media).toHaveLength(0);
  });
});

describe('createV2BodyLoader（gzip 路径）', () => {
  it('小包走直接解压并回填', async () => {
    const bodyJson = JSON.stringify({ id: 3, title: 'g', category: '工法', content: '<p>g</p>' });
    const gz = gzipSync(Buffer.from(bodyJson, 'utf8'));
    const store = {
      method: 'gzip' as const,
      bodiesB64: [Buffer.from(gz).toString('base64')],
      media: [] as string[],
    };
    const loader = createV2BodyLoader(store, [{ id: 3, title: 'g', category: '工法', order: 0, hasPdf: false }]);
    const a = await loader.loadBody(0);
    expect(a.content).toBe('<p>g</p>');
  });
});