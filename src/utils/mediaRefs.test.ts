/**
 * mediaRefs 纯函数层测试（P0-A）
 * 覆盖：抽取 / 去重 / 哈希 / 收集 / 还原 / 非 base64 不误抽 / 原对象不可变
 */
import { describe, it, expect } from 'vitest';
import {
  extractMediaFromString,
  extractArticleMedia,
  collectArticleMediaHashes,
  resolveArticleMedia,
  hashDataUrl,
  makeMediaRef,
  mimeOfDataUrl,
  isMediaRef,
  mediaHashFromRef,
} from './mediaRefs';

const IMG_A = 'data:image/webp;base64,' + 'A'.repeat(64);
const IMG_B = 'data:image/png;base64,' + 'B'.repeat(64);
const PDF = 'data:application/pdf;base64,' + 'C'.repeat(128);

describe('mediaRefs', () => {
  it('抽取正文内联媒体并替换为引用', () => {
    const html = `<p>前</p><img src="${IMG_A}"><p>后</p>`;
    const { text, media } = extractMediaFromString(html);

    expect(media).toHaveLength(1);
    expect(media[0].mime).toBe('image/webp');
    expect(text).toContain(makeMediaRef(media[0].hash));
    expect(text).not.toContain('base64,');
    expect(text).toContain('<p>前</p>');
  });

  it('同图重复出现只入库一次，引用一致', () => {
    const { text, media } = extractMediaFromString(`<img src="${IMG_A}"><img src="${IMG_A}">`);
    expect(media).toHaveLength(1);
    expect(text.match(/sws-media:\/\//g)).toHaveLength(2);
  });

  it('不同内容哈希不同（采样哈希可用）', () => {
    expect(hashDataUrl(IMG_A)).not.toBe(hashDataUrl(IMG_B));
    expect(hashDataUrl(IMG_A)).toBe(hashDataUrl(IMG_A));
    expect(hashDataUrl(IMG_A)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('非 base64 的 data URL 保持原样（不误抽）', () => {
    const inline = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E';
    const { text, media } = extractMediaFromString(`<img src="${inline}">`);
    expect(media).toHaveLength(0);
    expect(text).toContain(inline);
  });

  it('文章级抽取覆盖 content / blocks / 封面封底 / PDF', () => {
    const article = {
      id: 1,
      title: 't',
      content: `<p>x</p><img src="${IMG_A}">`,
      coverImage: IMG_B,
      pdfData: PDF,
      blocks: [{ id: 'b1', type: 'image', src: IMG_A }],
    };

    const { article: slim, media } = extractArticleMedia(article);

    expect(media.map(m => m.mime).sort()).toEqual(['application/pdf', 'image/png', 'image/webp']);
    expect(slim.content).not.toContain('base64');
    expect(isMediaRef(slim.coverImage)).toBe(true);
    expect(isMediaRef(slim.pdfData)).toBe(true);
    expect(isMediaRef((slim.blocks as { src: string }[])[0].src)).toBe(true);
    // 原对象不被就地修改
    expect(article.content).toContain('base64');
    expect(article.coverImage).toBe(IMG_B);
  });

  it('收集 + 还原可无损往返', () => {
    const article = { content: `<img src="${IMG_A}">`, pdfData: PDF };
    const { article: slim, media } = extractArticleMedia(article);

    const hashes = collectArticleMediaHashes(slim);
    expect(hashes.sort()).toEqual(media.map(m => m.hash).sort());

    const lookup = new Map(media.map(m => [m.hash, m.dataUrl] as const));
    const restored = resolveArticleMedia(slim, lookup);
    expect(restored.content).toBe(article.content);
    expect(restored.pdfData).toBe(PDF);
  });

  it('映射缺失时保留引用（不产生空 src）', () => {
    const ref = makeMediaRef('deadbeefdeadbeef');
    const restored = resolveArticleMedia({ content: `<img src="${ref}">` }, new Map());
    expect(restored.content).toContain(ref);
  });

  it('引用解析辅助函数', () => {
    const ref = makeMediaRef('0123456789abcdef');
    expect(isMediaRef(ref)).toBe(true);
    expect(isMediaRef('data:image/webp;base64,AA==')).toBe(false);
    expect(mediaHashFromRef(ref)).toBe('0123456789abcdef');
    expect(mediaHashFromRef('sws-media://非法字符!')).toBeNull();
    expect(mimeOfDataUrl(PDF)).toBe('application/pdf');
  });

  it('无媒体文本快速返回且不改变引用', () => {
    const html = '<p>纯文本</p>';
    const { text, media } = extractMediaFromString(html);
    expect(text).toBe(html);
    expect(media).toHaveLength(0);
  });
});
