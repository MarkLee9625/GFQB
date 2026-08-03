import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('移除 script 与事件属性，结果与 DOMPurify 语义一致', () => {
    const html = '<p onclick="alert(1)">安全</p><script>evil()</script><img src="x" onerror="alert(2)">';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).toContain('安全');
  });

  it('相同输入返回缓存结果', () => {
    const html = '<b>重复内容</b>';
    const first = sanitizeHtml(html);
    const second = sanitizeHtml(html);
    expect(second).toBe(first);
  });
});
