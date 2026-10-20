import { describe, it, expect } from 'vitest';
import { isValidReaderTemplate } from './reader';
import { stripRedundantBlocks } from './v2format';
import type { Article } from '../../types/models';

const VALID_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <title>工法情报阅读器</title>
</head>
<body>
  <div id="root"></div>
  <!--SWS_READER_DATA-->
</body>
</html>`;

describe('isValidReaderTemplate', () => {
  it('接受带数据注入锚点的阅读版模板', () => {
    expect(isValidReaderTemplate(VALID_TEMPLATE)).toBe(true);
  });

  it('拒绝 Vite dev SPA fallback 返回的开发版 index.html', () => {
    const devIndexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <script type="module" src="/@vite/client"></script>
  <title>SWS 工法情报收集系统</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/index.tsx"></script>
</body>
</html>`;
    expect(isValidReaderTemplate(devIndexHtml)).toBe(false);
  });

  it('拒绝不含阅读器标记的普通 HTML', () => {
    expect(isValidReaderTemplate('<html><body><p>普通页面</p></body></html>')).toBe(false);
  });

  it('拒绝不完整内容', () => {
    expect(isValidReaderTemplate('<html><head></head>')).toBe(false);
    expect(isValidReaderTemplate('')).toBe(false);
  });
});

describe('stripRedundantBlocks（R-D0）', () => {
  const vid = 'data:video/mp4;base64,' + 'A'.repeat(100);
  const mk = (partial: Partial<Article> & { id: number }): Article =>
    ({ title: `t${partial.id}`, category: '工法', content: '', ...partial }) as Article;

  it('有 content 即剥离 blocks（阅读器可无损重算）', () => {
    const a = mk({
      id: 1,
      content: `<p>正文</p><video src="${vid}"></video>`,
      blocks: [{ id: 'blk-1', type: 'rawHtml', html: `<video src="${vid}"></video>` }] as never,
    });
    const { slim, stripped, kept } = stripRedundantBlocks([a]);
    expect(stripped).toBe(1);
    expect(kept).toBe(0);
    expect(slim[0].blocks).toBeUndefined();
    expect(slim[0].content).toContain('正文');
    // 原数组不被改动
    expect(a.blocks).toHaveLength(1);
  });

  it('空 content 但有 blocks 时保留（无法重算）', () => {
    const a = mk({
      id: 2,
      content: '   ',
      blocks: [{ id: 'blk-2', type: 'paragraph', content: '孤块' }] as never,
    });
    const { slim, stripped, kept } = stripRedundantBlocks([a]);
    expect(stripped).toBe(0);
    expect(kept).toBe(1);
    expect(slim[0].blocks).toHaveLength(1);
  });

  it('无 blocks 的文章原样通过', () => {
    const a = mk({ id: 3, content: '<p>纯文本</p>' });
    const { slim, stripped, kept } = stripRedundantBlocks([a]);
    expect(stripped).toBe(0);
    expect(kept).toBe(0);
    expect(slim[0]).toBe(a);
  });
});
