/**
 * 媒体库服务测试（P0-A）
 * 覆盖：写侧抽取（文章落引用/媒体入库）/ 多篇共用去重 / 引用还原 /
 *       旧库迁移幂等 / 引用计数重算 / 孤儿只统计不删除 / blob 解析
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { db } from '../../services/db';
import {
  getMediaDataUrl,
  resolveArticlesMediaData,
  migrateArticlesToMediaRefs,
  recalcMediaRefs,
  clearMediaDataCache,
  isMediaMigrationDone,
  findMissingMediaHashes,
} from '../../services/mediaStore';
import { collectArticleMediaHashes } from '../../src/utils/mediaRefs';
import { useBlobManager } from '../../hooks/useBlobManager';

const IMG_A = 'data:image/webp;base64,' + 'A'.repeat(64);
const IMG_B = 'data:image/png;base64,' + 'B'.repeat(64);

function makeArticle(id: number, content: string, extra: Record<string, unknown> = {}) {
  return { id, title: `文章 ${id}`, category: '工法', content, order: id * 1000, ...extra };
}

describe('mediaStore 媒体库（P0-A）', () => {
  beforeAll(() => {
    // jsdom 不实现 createObjectURL；blob 解析用例需要它
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:mock-url');
      (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
    }
  });

  beforeEach(async () => {
    clearMediaDataCache();
    await db.init();
    await db.clearAll();
  });

  it('saveArticle 抽取内联媒体：文章落引用、媒体入 media_store', async () => {
    await db.saveArticle(makeArticle(101, `<p>x</p><img src="${IMG_A}">`) as never);

    const saved = (await db.getArticles()).find(a => a.id === 101)!;
    expect(saved.content).not.toContain('base64');

    const hashes = collectArticleMediaHashes(saved);
    expect(hashes).toHaveLength(1);
    expect(await getMediaDataUrl(hashes[0])).toBe(IMG_A);
    expect(await db.getAllMedia()).toHaveLength(1);
  });

  it('多篇共用同一媒体只存一份（内容哈希去重）', async () => {
    await db.saveArticle(makeArticle(201, `<img src="${IMG_A}">`) as never);
    await db.saveArticle(makeArticle(202, `<img src="${IMG_A}">`) as never);

    const all = await db.getAllMedia();
    expect(all).toHaveLength(1);
    // 两篇文章引用同一 hash
    const articles = await db.getArticles();
    const hashesA = collectArticleMediaHashes(articles.find(a => a.id === 201));
    const hashesB = collectArticleMediaHashes(articles.find(a => a.id === 202));
    expect(hashesA).toEqual(hashesB);
  });

  it('批量写入（clearAndBulkSaveArticles）同样抽取媒体', async () => {
    await db.clearAndBulkSaveArticles([
      makeArticle(301, `<img src="${IMG_A}">`),
      makeArticle(302, `<img src="${IMG_B}">`),
    ] as never);

    expect(await db.getAllMedia()).toHaveLength(2);
    const articles = await db.getArticles();
    expect(articles.every(a => !a.content.includes('base64'))).toBe(true);
  });

  it('resolveArticlesMediaData 还原全部引用（导出/AI 前置）', async () => {
    await db.saveArticle(makeArticle(401, `<img src="${IMG_A}">`, { coverImage: IMG_B }) as never);
    const slim = await db.getArticles();

    const resolved = await resolveArticlesMediaData(slim);
    expect(resolved[0].content).toContain(IMG_A);
    expect(resolved[0].coverImage).toBe(IMG_B);
    expect(resolved[0].content).not.toContain('sws-media://');
  });

  it('旧库迁移：抽取完成、幂等、二次调用跳过', async () => {
    // 模拟旧库：绕过 saveArticle 的抽取，直接写原始（含 base64）记录
    await db.save('article-501', makeArticle(501, `<img src="${IMG_A}">`));

    const first = await migrateArticlesToMediaRefs();
    expect(first.skipped).toBe(false);
    expect(await isMediaMigrationDone()).toBe(true);

    const migrated = (await db.getArticles()).find(a => a.id === 501)!;
    expect(migrated.content).not.toContain('base64');
    expect(await db.getAllMedia()).toHaveLength(1);

    const second = await migrateArticlesToMediaRefs();
    expect(second.skipped).toBe(true);
  });

  it('引用计数重算：被引用媒体 refCount 正确', async () => {
    await db.saveArticle(makeArticle(601, `<img src="${IMG_A}">`) as never);

    const result = await recalcMediaRefs();
    expect(result.total).toBe(1);
    expect(result.orphans).toBe(0);

    const [record] = await db.getAllMedia();
    expect(record.refCount).toBe(1);
  });

  it('孤儿媒体只统计不物理删除（首版安全策略）', async () => {
    await db.saveArticle(makeArticle(701, `<img src="${IMG_A}">`) as never);
    // 让引用消失：直接改写为无媒体版本
    await db.save('article-701', makeArticle(701, '<p>已移除图片</p>'));

    const result = await recalcMediaRefs();
    expect(result.orphans).toBe(1);
    expect(result.deleted).toBe(0);
    expect(await db.getAllMedia()).toHaveLength(1); // 仍在库中，可人工恢复
  });

  it('存储瘦身量化：图文篇落库体积远小于原始（content/blocks 双份去重）', async () => {
    const bigImage = 'data:image/webp;base64,' + 'A'.repeat(200_000); // ≈200KB 模拟一张压缩后图片
    const article = {
      id: 1001,
      title: '图文篇',
      category: '工法',
      order: 1000,
      content: `<p>${'正文内容'.repeat(500)}</p><img src="${bigImage}">`,
      blocks: [{ id: 'b1', type: 'image', src: bigImage }],
    };
    const originalSize = JSON.stringify(article).length;

    await db.saveArticle(article as never);
    const stored = (await db.getArticles())[0];
    const storedSize = JSON.stringify(stored).length;
    const media = await db.getAllMedia();

    console.log(`[P0-A 瘦身] 原始 ${(originalSize / 1024).toFixed(1)}KB → 落库 ${(storedSize / 1024).toFixed(1)}KB `
      + `(${(storedSize / originalSize * 100).toFixed(2)}%)，媒体库 ${media.length} 条 / ${(media[0].dataUrl.length / 1024).toFixed(1)}KB`);

    expect(media).toHaveLength(1);                      // 同一张图只存一份
    expect(stored.content).not.toContain('base64');
    expect(storedSize).toBeLessThan(originalSize * 0.05); // 文章本体降到原体积 5% 以内
  });

  it('getBlobUrlAsync 能解析 sws-media:// 引用（渲染链路）', async () => {
    await db.saveArticle(makeArticle(801, `<img src="${IMG_A}">`) as never);
    const [hash] = collectArticleMediaHashes((await db.getArticles())[0]);

    const { result } = renderHook(() => useBlobManager());
    const url = await result.current.getBlobUrlAsync(`sws-media://${hash}`);
    expect(url).toMatch(/^blob:/);

    // 非引用输入保持原行为
    expect(await result.current.getBlobUrlAsync('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(await result.current.getBlobUrlAsync(null)).toBeNull();
  });

  it('无内联媒体时迁移短路：不重写任何文章，仅落标记', async () => {
    const spy = vi.spyOn(db, 'saveArticle');
    const result = await migrateArticlesToMediaRefs({
      articles: [makeArticle(1, '<p>纯文本，无媒体</p>')] as never,
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.migrated).toBe(0);
    expect(await isMediaMigrationDone()).toBe(true);
  });

  it('findMissingMediaHashes 报出悬空引用；媒体存在时不报', async () => {
    expect(await findMissingMediaHashes([{ content: '<img src="sws-media://deadbeefdeadbeef">' }]))
      .toEqual(['deadbeefdeadbeef']);

    await db.saveArticle(makeArticle(901, `<img src="${IMG_A}">`) as never);
    expect(await findMissingMediaHashes(await db.getArticles())).toEqual([]);
  });
});
