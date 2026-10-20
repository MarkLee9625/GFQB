import { describe, it, expect, vi } from 'vitest';
import { gunzipSync } from 'fflate';

// 强制 fflate 路径：jsdom 下原生 CompressionStream 与 ReadableStream 跨 realm pipe 会损坏，
// 真浏览器无此问题；单测只验往返一致性，走确定性的 fflate。
vi.stubGlobal('CompressionStream', undefined);
vi.stubGlobal('DecompressionStream', undefined);
import {
  V2_MEDIA_TOKEN_PREFIX,
  buildV2InjectionScript,
  buildV2Manifest,
  normalizePdfData,
  pickShell,
  restoreV2Article,
  splitArticleMedia,
} from './v2format';
import { compressData, uint8ArrayToBase64 } from './compression';
import type { Article } from '../../types/models';

const IMG = 'data:image/webp;base64,' + 'A'.repeat(100);
const VID = 'data:video/mp4;base64,' + 'B'.repeat(100);
const PDF_BARE = Buffer.from('%PDF-1.4 fake-bytes').toString('base64');

function mkArticle(partial: Partial<Article> & { id: number }): Article {
  return { title: `t${partial.id}`, category: '工法', content: '', order: partial.id, ...partial } as Article;
}

describe('v2format 媒体抽取/回填', () => {
  it('round-trip：cover/正文视频/裸pdf/blocks 图全覆盖', () => {
    const a = mkArticle({
      id: 1,
      content: `<p>正文</p><video src="${VID}"></video>`,
      coverImage: IMG,
      pdfData: PDF_BARE,
      abstract: '摘要',
      blocks: [{ id: 'b1', type: 'image', src: IMG }] as never,
    });
    const table = new Map<string, number>();
    const media: string[] = [];
    const { bodyJson, shell } = splitArticleMedia(a, table, media);

    // 媒体全抽走（cover 与 blocks 共用 IMG → 去重后 3 项）
    expect(media).toHaveLength(3);
    expect(bodyJson).not.toContain('base64,');
    expect(bodyJson).toContain(`${V2_MEDIA_TOKEN_PREFIX}0__`);
    expect(shell).toMatchObject({ id: 1, title: 't1', abstract: '摘要' });
    expect(shell).not.toHaveProperty('content');

    const back = restoreV2Article(bodyJson, media);
    expect(back.content).toBe(a.content);
    expect(back.coverImage).toBe(IMG);
    // 裸 pdf 归一为 data URI（阅读器双兼容）
    expect(back.pdfData).toBe(`data:application/pdf;base64,${PDF_BARE}`);
    expect(back.abstract).toBe('摘要');
    expect(JSON.stringify(back.blocks)).toContain(IMG);
  });

  it('跨篇去重：同图只存一份', () => {
    const m = buildV2Manifest([
      mkArticle({ id: 1, content: `<img src="${IMG}">` }),
      mkArticle({ id: 2, content: `<img src="${IMG}"><img src="${IMG}">` }),
    ]);
    expect(m.media).toHaveLength(1);
    expect(m.bodyJsons).toHaveLength(2);
    expect(m.shells.map((s) => s.id)).toEqual([1, 2]);
    expect(restoreV2Article(m.bodyJsons[1], m.media).content).toContain(IMG);
  });

  it('正文含完整 token 形态即拒绝导出，裸前缀放行', () => {
    const bad = mkArticle({ id: 9, content: `<p>${V2_MEDIA_TOKEN_PREFIX}0__ 伪造</p>` });
    expect(() => splitArticleMedia(bad, new Map(), [])).toThrow(/保留 token/);
    // 裸前缀（教程讨论 token 本身）：回填正则只认完整形态，可安全通过
    const ok = mkArticle({ id: 10, content: `<p>token 前缀形如 ${V2_MEDIA_TOKEN_PREFIX} 加数字</p>` });
    const table = new Map<string, number>();
    const media: string[] = [];
    const { bodyJson } = splitArticleMedia(ok, table, media);
    expect(media).toHaveLength(0);
    expect(restoreV2Article(bodyJson, media).content).toContain(V2_MEDIA_TOKEN_PREFIX);
  });

  it('回填下标越界即抛错', () => {
    expect(() => restoreV2Article(`{"x":"${V2_MEDIA_TOKEN_PREFIX}7__"}`, ['image/png,AAA'])).toThrow(/越界/);
    expect(() => restoreV2Article(`{"x":"${V2_MEDIA_TOKEN_PREFIX}0__"}`, ['no-comma'])).toThrow(/损坏/);
  });

  it('normalizePdfData：data URI 原样，裸 base64 归一', () => {
    expect(normalizePdfData(mkArticle({ id: 1, pdfData: 'data:application/pdf;base64,QUJD' })).pdfData).toBe(
      'data:application/pdf;base64,QUJD'
    );
    expect(normalizePdfData(mkArticle({ id: 2, pdfData: 'UVJD' })).pdfData).toBe('data:application/pdf;base64,UVJD');
    expect(normalizePdfData(mkArticle({ id: 3 })).pdfData).toBeUndefined();
  });

  it('pickShell 只取小字段', () => {
    const s = pickShell(mkArticle({ id: 1, content: 'x', coverImage: IMG, pdfData: PDF_BARE, tags: ['a'] }));
    expect(Object.keys(s).sort()).toEqual(['category', 'hasPdf', 'id', 'order', 'tags', 'title']);
    expect(s.hasPdf).toBe(true);
    expect(pickShell(mkArticle({ id: 2 })).hasPdf).toBe(false);
  });

  it('全链路 round-trip：gzip 真压缩 → 解压 → 回填一致', async () => {
    const m = buildV2Manifest([
      mkArticle({ id: 1, content: `<p>甲</p><video src="${VID}"></video>`, coverImage: IMG }),
      mkArticle({ id: 2, content: '<p>乙无媒体</p>' }),
    ]);
    expect(m.media).toHaveLength(2);

    // meta + bodies 走真 gzip（vitest 下经 fflate 回退，method 仍为 gzip）
    const metaC = await compressData(JSON.stringify(m.shells), 'gzip');
    expect(metaC.method).toBe('gzip');
    const bodyC = await Promise.all(m.bodyJsons.map((b) => compressData(b, 'gzip')));
    const metaB64 = uint8ArrayToBase64(metaC.data);
    const bodyB64s = bodyC.map((c) => uint8ArrayToBase64(c.data));

    // 解码（Buffer 代 atob，fflate 代 DecompressionStream）
    const gunzipB64 = (b64: string) =>
      Buffer.from(gunzipSync(Uint8Array.from(Buffer.from(b64, 'base64')))).toString('utf-8');
    const shells = JSON.parse(gunzipB64(metaB64));
    expect(shells).toHaveLength(2);
    const a0 = restoreV2Article(gunzipB64(bodyB64s[0]), m.media);
    expect(a0.content).toContain(VID);
    expect(a0.coverImage).toBe(IMG);
    const a1 = restoreV2Article(gunzipB64(bodyB64s[1]), m.media);
    expect(a1.content).toBe('<p>乙无媒体</p>');
  });
});

describe('buildV2InjectionScript', () => {
  it('六变量齐全，数组逐项引号包裹', () => {
    const s = buildV2InjectionScript({
      metaB64: 'META',
      bodiesB64: ['B0', 'B1'],
      media: ['image/png,AAA'],
      configB64: 'CFG',
      compressionMethod: 'gzip',
    });
    expect(s).toContain('window.__SWS_FORMAT__="v2"');
    expect(s).toContain('window.__SWS_V2_BODIES_B64__=["B0","B1"]');
    expect(s).toContain('window.__SWS_V2_MEDIA__=["image/png,AAA"]');
    expect(s).toContain('window.__SWS_DATA_CONFIG_B64__="CFG"');
  });

  it('恶意 `</script>` 不破环（JSON 引号 + `</` 转义）', () => {
    const hostile = 'AB</script><script>alert(1)</script>C"D\\E';
    const s = buildV2InjectionScript({
      metaB64: hostile,
      bodiesB64: [],
      media: [],
      configB64: '',
      compressionMethod: 'gzip',
    });
    // 注入脚本自身的首尾 script 标签之外不得出现裸 `</script`
    const inner = s.slice('<script>'.length, s.lastIndexOf('</script>'));
    expect(inner).not.toContain('</script');
    expect(inner).toContain('<\\/script');
    // 引号/反斜杠经 JSON 转义后可被 JS 正确解析
    expect(() => new Function(`${inner};return window.__SWS_V2_META_B64__;`)).not.toThrow();
  });
});
