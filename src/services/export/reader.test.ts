import { describe, it, expect } from 'vitest';
import { isValidReaderTemplate } from './reader';

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
