import { describe, it, expect, vi } from 'vitest';

// 同 print.test.ts：mock 掉 PDF.js 真模块，只测 HTML 组装逻辑。
vi.mock('../pdf', () => ({
  convertPdfToImages: vi.fn(async () => ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB']),
}));

import { generatePrintableHTML } from './print';
import type { Article } from '../../types/models';

function makeArticle(partial: Partial<Article> & { id: number; title: string }): Article {
  return {
    category: '工法',
    content: '',
    tags: [],
    order: 0,
    ...partial,
  } as Article;
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const pdfDataUri = 'data:application/pdf;base64,' + btoa('%PDF-1.4 fake');

describe('generatePrintableHTML 结构', () => {
  it('封面/目录/正文/封底齐全，目录只出现一次且页码按 PDF 实页预填', async () => {
    const cover = makeArticle({ id: 1, title: '封面', category: '封面', issueText: 'NO.07', dateText: 'JUL 2026', order: 0 });
    const a = makeArticle({
      id: 2, title: '文章A', order: 1, tags: ['焊接'],
      abstract: '这是摘要',
      content: '<p>这是一段足够长的正文内容，用于判定有实质性正文，长度超过阈值要求。</p>',
    });
    const b = makeArticle({ id: 3, title: '纯PDF篇', order: 2, pdfData: pdfDataUri });
    const c = makeArticle({
      id: 4, title: '短引言+PDF', order: 3, abstract: '短篇摘要',
      content: '<p>PDF见附件，全文共三页内容详见下文说明</p>',
      pdfData: pdfDataUri,
    });
    const back = makeArticle({ id: 5, title: '封底', category: '封底', order: 99999 });

    const progress: Array<[number, number]> = [];
    const html = await generatePrintableHTML(
      [back, c, a, cover, b],
      { useAlternateDesign: false },
      { logo: '' },
      (done, total) => progress.push([done, total])
    );
    const doc = parse(html);

    // 目录唯一
    expect(doc.querySelectorAll('.toc-page').length).toBe(1);
    // 封面/封底标记
    expect(doc.querySelectorAll('.cover-page').length).toBe(1);
    expect(doc.querySelectorAll('.back-page').length).toBe(1);
    // 首个内容块取消 break-before
    const firstContent = doc.querySelector('.toc-page');
    expect(firstContent?.classList.contains('first-page')).toBe(true);

    // 目录项与正文按 id 对齐：A=3（正文1页），B=4（纯图2页），C=6（头1页+图2页）
    const items = Array.from(doc.querySelectorAll('.toc-item'));
    expect(items.map((el) => el.getAttribute('data-target-id'))).toEqual(['2', '3', '4']);
    expect(items.map((el) => el.querySelector('.toc-page-number')?.textContent)).toEqual(['3', '4', '6']);

    // 纯 PDF 篇无头 wrapper，只有两页图且带文章 id
    expect(doc.querySelector('.article-wrapper[data-article-id="3"]')).toBeNull();
    const bPages = doc.querySelectorAll('.pdf-full-page[data-article-id="3"]');
    expect(bPages.length).toBe(2);

    // 短引言篇保留标题头 + 摘要 + 两页图
    const cHead = doc.querySelector('.article-wrapper[data-article-id="4"]');
    expect(cHead?.textContent).toContain('短引言+PDF');
    expect(cHead?.textContent).toContain('短篇摘要');
    expect(doc.querySelectorAll('.pdf-full-page[data-article-id="4"]').length).toBe(2);

    // A 篇摘要保留
    expect(doc.querySelector('.article-wrapper[data-article-id="2"]')?.textContent).toContain('这是摘要');

    // 文档标题带期号
    expect(doc.title).toContain('NO.07');

    // 进度回调从 0/3 到 3/3
    expect(progress[0]).toEqual([0, 3]);
    expect(progress[progress.length - 1]).toEqual([3, 3]);
  });

  it('无封面时目录置顶且页码从第 2 页起', async () => {
    const a = makeArticle({ id: 11, title: '唯一正文', order: 1, content: '<p>这是一段足够长的正文内容，用于判定有实质性正文，长度超过阈值要求。</p>' });
    const html = await generatePrintableHTML([a], {}, {});
    const doc = parse(html);
    expect(doc.querySelectorAll('.toc-page').length).toBe(1);
    expect(doc.querySelector('.toc-page')?.classList.contains('first-page')).toBe(true);
    expect(doc.querySelector('.toc-item .toc-page-number')?.textContent).toBe('2');
  });

  it('多封面只出一份目录', async () => {
    const c1 = makeArticle({ id: 21, title: '封面1', category: '封面', order: 0 });
    const c2 = makeArticle({ id: 22, title: '封面2', category: '封面', order: 0 });
    const a = makeArticle({ id: 23, title: '正文', order: 1, content: '<p>这是一段足够长的正文内容，用于判定有实质性正文，长度超过阈值要求。</p>' });
    const html = await generatePrintableHTML([c2, a, c1], {}, {});
    const doc = parse(html);
    expect(doc.querySelectorAll('.toc-page').length).toBe(1);
    expect(doc.querySelectorAll('.cover-page').length).toBe(2);
    // 两封面 + 目录 1 页，首篇正文第 4 页
    expect(doc.querySelector('.toc-item .toc-page-number')?.textContent).toBe('4');
  });

  it('内联脚本语法合法（只解析不执行）', async () => {
    const a = makeArticle({ id: 31, title: '正文', order: 1, content: '<p>这是一段足够长的正文内容，用于判定有实质性正文，长度超过阈值要求。</p>' });
    const html = await generatePrintableHTML([a], {}, {});
    const doc = parse(html);
    const scripts = Array.from(doc.querySelectorAll('script')).map((s) => s.textContent ?? '');
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) {
      expect(() => new Function(code)).not.toThrow();
    }
  });

  it('PDF 非法数据降级为失败占位且保留标题', async () => {
    const a = makeArticle({ id: 41, title: '坏PDF篇', order: 1, content: '<p>这是一段足够长的正文内容，用于判定有实质性正文，长度超过阈值要求。</p>', pdfData: 'not-base64!!!' });
    const html = await generatePrintableHTML([a], {}, {});
    const doc = parse(html);
    const head = doc.querySelector('.article-wrapper[data-article-id="41"]');
    expect(head?.textContent).toContain('坏PDF篇');
    expect(head?.textContent).toContain('PDF文档转换失败');
  });
});
