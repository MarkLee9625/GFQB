import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanHtmlResponse, cleanPlainTextResponse, warnIfLengthOff } from '../../services/ai/client';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('cleanHtmlResponse', () => {
    it('脱除 think 标签', () => {
        expect(cleanHtmlResponse('<think>推理过程</think><p>正文</p>')).toBe('<p>正文</p>');
    });

    it('脱除 ```html 围栏（含语言标记大小写）', () => {
        const fenced = '```html\n<p>卷首语</p>\n```';
        expect(cleanHtmlResponse(fenced)).toBe('<p>卷首语</p>');
        expect(cleanHtmlResponse('```HTML\n<p>卷首语</p>\n```')).toBe('<p>卷首语</p>');
    });

    it('无围栏的纯 HTML 原样保留', () => {
        const html = '<p>本期聚焦</p>\n<h3>一、突破</h3>';
        expect(cleanHtmlResponse(html)).toBe(html);
    });

    it('围栏与 think 混合时全部清洗', () => {
        const mixed = '<think>先想想</think>\n```html\n<p>正文</p>\n```';
        expect(cleanHtmlResponse(mixed)).toBe('<p>正文</p>');
    });
});

describe('cleanPlainTextResponse', () => {
    it('只洗 think 标签不动其他内容', () => {
        expect(cleanPlainTextResponse('<think>x</think>标题正文')).toBe('标题正文');
    });
});

describe('warnIfLengthOff', () => {
    it('区间内不告警', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnIfLengthOff('大型邮轮薄板激光复合焊变形控制工艺', 12, 25, '标题');
        expect(warn).not.toHaveBeenCalled();
    });

    it('超限告警并带出实际字数', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnIfLengthOff('太短', 12, 25, '标题');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('标题');
    });

    it('按码点计数（emoji 计 1 字而非 UTF-16 的 2 长度）', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnIfLengthOff('一二三🚀', 4, 10, '标题');
        expect(warn).not.toHaveBeenCalled();
    });
});
