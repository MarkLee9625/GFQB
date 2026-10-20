/**
 * 第3期端到端复现（A4）：工程备份 27 篇真实文章 → 真实 generatePrintableHTML →
 * 落盘 .tmp/issue3.print.html → headless 打印 → 页图谱 strict 判定。
 *
 * - PDF 光栅回放 issue3-prep.py 从已打印 PDF 提取的 63 张内容页（按 pdf 字节 sha1 命中），
 *   不跑 PDF.js（Node 下无 canvas），几何与真实导出逐位一致（同 dim 同 data URI 形态）。
 * - 在线图 0 处（prep 已审计），无网络依赖；视频走占位符（与真实链路一致）。
 * - 门控：仅 ISSUE3_REPRO=1 时执行（224MB 解析，普通 test 跳过）；落盘另需 WRITE_ISSUE3_HTML=1。
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('../pdf', () => ({
  convertPdfToImages: vi.fn(async (file: File) => {
    const { issue3RastersForPdf } = await import('./print.issue3.assets');
    return issue3RastersForPdf(file);
  }),
}));

import { generatePrintableHTML } from './print';
import { TMP_DIR, issue3Meta } from './print.issue3.assets';
import type { Article } from '../../types/models';

const ENABLED = process.env.ISSUE3_REPRO === '1';
const PROJECT_HTML =
  process.env.ISSUE3_PROJECT_HTML ||
  'C:/Users/MA/OneDrive - stu.just.edu.cn/工法情报收集/2026第3期/SWS_Project_2026-10-20.html';

function loadProjectArticles(): Article[] {
  const raw = fs.readFileSync(PROJECT_HTML, 'utf-8');
  const a = raw.indexOf('DATA START');
  const b = raw.indexOf('DATA END');
  if (a < 0 || b <= a) throw new Error('[issue3] 工程备份标记缺失');
  return JSON.parse(raw.slice(a + 'DATA START'.length, b).trim()) as Article[];
}

describe.skipIf(!ENABLED)('第3期端到端复现', () => {
  let html = '';

  beforeAll(async () => {
    const articles = loadProjectArticles();
    expect(articles.length).toBe(27);
    const { logo } = issue3Meta();
    html = await generatePrintableHTML(articles, { useAlternateDesign: false }, { logo });
    if (process.env.WRITE_ISSUE3_HTML === '1') {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      fs.writeFileSync(path.join(TMP_DIR, 'issue3.print.html'), html, 'utf-8');
    }
  }, 300000);

  it('63 张 PDF 光栅 + 27 篇结构完整 + 无媒体引用外泄', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.cover-page').length).toBe(1);
    expect(doc.querySelectorAll('.toc-page').length).toBe(1);
    expect(doc.querySelectorAll('.back-page').length).toBe(1);
    expect(doc.querySelectorAll('.pdf-full-page').length).toBe(63);
    expect(doc.querySelectorAll('.toc-item').length).toBe(25);
    expect(html).not.toContain('sws-media://');
  });
});
