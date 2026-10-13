/**
 * 导出链路的媒体引用还原守卫（P0-A）
 *
 * 契约：导出引擎即使被直接调用（绕过 useExportManager），也必须产出**自包含**内容——
 * 媒体引用 `sws-media://` 不得外泄到 HTML 里（阅读器/打印版都是单文件交付物）。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../../services/db';
import { clearMediaDataCache } from '../../../services/mediaStore';
import { generatePrintableHTML } from './print';
import { collectArticleMediaHashes } from '../../utils/mediaRefs';

vi.mock('../pdf', () => ({ convertPdfToImages: vi.fn(async () => []) }));

const IMG_A = 'data:image/webp;base64,' + 'A'.repeat(64);

describe('导出引擎媒体还原（P0-A）', () => {
  beforeAll(() => {
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

  it('库内为引用形态，打印版产物已还原为 data URL', async () => {
    await db.saveArticle({
      id: 901,
      title: '带图文章',
      category: '工法',
      order: 1000,
      content: `<p>这是一段足够长的正文内容，用于判定有实质性正文，长度超过阈值要求。</p><img src="${IMG_A}">`,
    } as never);

    const slim = await db.getArticles();
    expect(slim[0].content).not.toContain('base64');            // 库里是引用
    expect(collectArticleMediaHashes(slim[0])).toHaveLength(1);

    const html = await generatePrintableHTML(slim, {}, {});
    expect(html).not.toContain('sws-media://');                  // 不外泄引用
    expect(html).toContain(IMG_A);                               // 已内联真实媒体
  });
});
