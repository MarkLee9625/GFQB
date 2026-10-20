/**
 * 打印验证台架（A1）：用真实 generatePrintableHTML 生成 fixture，
 * 供 headless Chrome 打 PDF + page-map.py 做空白/残片页判定。
 *
 * - convertPdfToImages 被 mock：按 pdfData 内埋的 RATIO 标记返回
 *   scripts/print-verify/assets/ 内对应长宽比的仿真光栅页（5 种实测比）。
 * - 仅当 WRITE_PRINT_FIXTURE=1 时落盘 fixture（npm run verify:print 设置），
 *   普通 `npm run test` 只跑结构断言，不写文件。
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('../pdf', () => ({
  convertPdfToImages: vi.fn(async (file: File) => {
    // 动态 import：mock 工厂在模块求值前执行，不可闭包引用顶层变量
    const { assetDataUri } = await import('./print.harness.assets');
    const text = await file.text();
    const m = /RATIO:([0-9a-zx]+)/.exec(text);
    const key = m ? m[1] : '1190x1616';
    const uri = assetDataUri(key);
    return [uri, uri, uri]; // 每篇 3 页
  }),
}));

import { TMP_DIR } from './print.harness.assets';

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

/** 埋 RATIO 标记的合法 pdfData（%PDF 头通过 decodePdfBytes 校验） */
function pdfDataFor(ratioKey: string): string {
  const raw = `%PDF-1.4 fake RATIO:${ratioKey} ` + 'x'.repeat(64);
  return 'data:application/pdf;base64,' + Buffer.from(raw).toString('base64');
}

function longContent(paragraphs: number): string {
  const p = '<p>工法情报验证段落：本段用于填充正文高度，检验文章容器在分页时的行为，包含足够的中文字符以模拟真实排版效果。</p>';
  return p.repeat(paragraphs);
}

describe('打印验证台架 fixture', () => {
  let html = '';

  beforeAll(async () => {
    const articles: Article[] = [
      makeArticle({ id: 1, title: '封面', category: '封面', issueText: 'NO.03', dateText: 'Oct 2026', order: 0 }),
      makeArticle({ id: 2, title: '文字文章一', order: 1, tags: ['验证'], content: longContent(14) }),
      makeArticle({
        id: 3, title: '焊接顺序（1224x1684）', order: 2, abstract: '摘要头+3页光栅',
        pdfData: pdfDataFor('1224x1684'),
      }),
      makeArticle({ id: 4, title: '三维模型（1208x1650a）', order: 3, pdfData: pdfDataFor('1208x1650a') }),
      makeArticle({ id: 5, title: '激光清理（1190x1616）', order: 4, pdfData: pdfDataFor('1190x1616') }),
      makeArticle({
        id: 6, title: '知识图谱（1208x1650b）', order: 5, abstract: '摘要头+3页光栅',
        pdfData: pdfDataFor('1208x1650b'),
      }),
      makeArticle({ id: 7, title: '知识驱动（1190x1684）', order: 6, pdfData: pdfDataFor('1190x1684') }),
      makeArticle({ id: 8, title: '文字文章二', order: 7, content: longContent(6) }),
      makeArticle({ id: 9, title: '封底', category: '封底', order: 99999 }),
    ];
    html = await generatePrintableHTML(articles, { useAlternateDesign: false }, { logo: '' });
    if (process.env.WRITE_PRINT_FIXTURE === '1') {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      fs.writeFileSync(path.join(TMP_DIR, 'fixture.print.html'), html, 'utf-8');
    }
  });

  it('fixture 结构：封面/目录/正文/5篇PDF各3页/封底', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.cover-page').length).toBe(1);
    expect(doc.querySelectorAll('.toc-page').length).toBe(1);
    expect(doc.querySelectorAll('.back-page').length).toBe(1);
    expect(doc.querySelectorAll('.pdf-full-page').length).toBe(15);
    for (const id of ['3', '4', '5', '6', '7']) {
      expect(doc.querySelectorAll(`.pdf-full-page[data-article-id="${id}"]`).length).toBe(3);
    }
    // 摘要头篇保留标题头，纯图篇无头 wrapper
    expect(doc.querySelector('.article-wrapper[data-article-id="3"]')).not.toBeNull();
    expect(doc.querySelector('.article-wrapper[data-article-id="4"]')).toBeNull();
  });

  it('A2 回归：PDF 页图打印双约束存在（防撕裂残片页）', () => {
    // .pdf-full-page img 块内必须有 max-height:280mm + max-width:100% + 居中
    const imgRule = /\.pdf-full-page img\s*\{[^}]*\}/g;
    const rules = html.match(imgRule) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    const printRule = rules.find((r) => r.includes('max-height'));
    expect(printRule).toBeDefined();
    expect(printRule).toContain('max-height: 280mm');
    expect(printRule).toContain('max-width: 100%');
    expect(printRule).toContain('margin: 0 auto');
    // wrapper 必须禁内部分页
    expect(html).toMatch(/\.print-page-wrapper\.pdf-full-page\s*\{[^}]*break-inside:\s*avoid/);
  });

  it('A3 回归：@page 统一 + 封面封底打印定高 285mm（无 100vh 溢出）', () => {
    // 不允许再出现 margin:0 的 @page（与 skeleton 的 12mm 底边距打架）
    expect(html).not.toMatch(/@page\s*\{\s*margin:\s*0\s*;/);
    // 肯定断言：两处 @page 值一致（删一处也能发现）
    const pageRules = html.match(/@page\s*\{[^}]*\}/g) ?? [];
    expect(pageRules.length).toBeGreaterThanOrEqual(2);
    for (const rule of pageRules) {
      expect(rule).toMatch(/margin:\s*0\s+0\s+12mm/);
    }
    // 封面/封底内根打印定高 285mm
    expect(html).toMatch(/\.cover-root,\s*\.magazine-cover[^{]*\{[^}]*height:\s*285mm/);
  });

  it('A3 回归：正文/目录 wrapper 打印底 padding 为 0（防孤儿 padding 空白页）', () => {
    expect(html).toMatch(
      /\.print-page-wrapper\.article-wrapper,\s*\.print-page-wrapper\.toc-page\s*\{[^}]*padding:\s*5mm 20mm 0/
    );
  });
});
