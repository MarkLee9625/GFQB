import { describe, it, expect } from 'vitest';
import { getClientBootCode } from './boot';

describe('getClientBootCode（R1-a）', () => {
  it('ES5 约束：无反引号与 ${}', () => {
    const code = getClientBootCode();
    expect(code).not.toContain('`');
    expect(code).not.toContain('${');
  });

  it('none 路径走 TextDecoder 封装（无逐字符 escape 老式解码）', () => {
    const code = getClientBootCode();
    expect(code).toContain('function b64ToUtf8(b64)');
    expect(code).toContain('JSON.parse(b64ToUtf8(window.__SWS_DATA_ARTICLES_B64__))');
    // 仅允许 b64ToUtf8 内部的远古浏览器回退出现 escape
    const hits = code.match(/decodeURIComponent\(escape\(/g) ?? [];
    expect(hits.length).toBe(1);
  });

  it('语法合法（只解析不执行）', () => {
    expect(() => new Function(getClientBootCode())).not.toThrow();
  });
});
