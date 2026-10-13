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

  it('P0-A：媒体引用 sws-media:// 的 src 不被剥离', () => {
    const html = '<p>x</p><img src="sws-media://0123456789abcdef">';
    const result = sanitizeHtml(html);
    expect(result).toContain('sws-media://0123456789abcdef');
  });

  it('P0-A：视频/音频（rawHtml 媒体容器）的引用 src 同样不被剥离', () => {
    const html = '<div class="media-container"><video controls src="sws-media://0123456789abcdef"></video></div>';
    expect(sanitizeHtml(html)).toContain('sws-media://0123456789abcdef');
  });

  it('危险 scheme 仍被拒绝；相对路径与 data 图片照常放行', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    expect(sanitizeHtml('<img src="/local/a.png">')).toContain('/local/a.png');
    expect(sanitizeHtml('<img src="data:image/webp;base64,AAAA">')).toContain('data:image/webp');
  });
});
