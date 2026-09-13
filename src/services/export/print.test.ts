import { describe, it, expect, vi } from 'vitest';

// print.ts 顶层依赖 PDF.js 真模块（Node 下缺 DOMMatrix），此处 mock 掉，
// 本文件只测纯函数（文本判定/pdfData 清洗/常量），不测光栅化。
vi.mock('../pdf', () => ({ convertPdfToImages: vi.fn(async () => []) }));

import { getPlainText } from '../../utils/stringUtils';
import { splitDataUri, decodePdfBytes } from './utils/file';
import {
  hasPrintableBodyContent,
  PRINT_BODY_TEXT_THRESHOLD,
  PRINT_MAX_TOTAL_PDF_PAGES,
} from './print';

function pdfBase64(payload = 'hello-print'): string {
  const raw = `%PDF-1.4 ${payload}`;
  return btoa(raw);
}

describe('getPlainText', () => {
  it('去标签并压缩空白', () => {
    expect(getPlainText('<p>你好 <strong>世界</strong></p>')).toBe('你好 世界');
  });

  it('解码命名实体与数字实体', () => {
    expect(getPlainText('<p>a&nbsp;b&ldquo;c&#65;&#x42;</p>')).toBe('a b c');
  });

  it('空段落残留判空', () => {
    expect(getPlainText('<p><br></p><p>   </p>')).toBe('');
  });
});

describe('hasPrintableBodyContent', () => {
  it('空内容判无正文', () => {
    expect(hasPrintableBodyContent('')).toBe(false);
    expect(hasPrintableBodyContent('<p><br></p>')).toBe(false);
  });

  it('短引言也算有正文（不再被 80 字一刀切丢弃）', () => {
    expect(hasPrintableBodyContent('<p>PDF见附件，全文共三页内容详见下文</p>')).toBe(true);
  });

  it(`阈值常量为 ${PRINT_BODY_TEXT_THRESHOLD}`, () => {
    expect(PRINT_BODY_TEXT_THRESHOLD).toBe(10);
  });
});

describe('splitDataUri', () => {
  it('兼容 DataURI', () => {
    const r = splitDataUri('data:application/pdf;base64,QUJD');
    expect(r).toEqual({ mime: 'application/pdf', base64: 'QUJD' });
  });

  it('兼容裸 base64', () => {
    const r = splitDataUri('QUJD');
    expect(r?.base64).toBe('QUJD');
  });

  it('非法输入返回 null', () => {
    expect(splitDataUri('')).toBeNull();
    expect(splitDataUri('data:application/pdf;base64,')).toBeNull();
  });
});

describe('decodePdfBytes', () => {
  it('DataURI 与裸 base64 均可解出 PDF 头', () => {
    const raw = pdfBase64();
    expect(decodePdfBytes(`data:application/pdf;base64,${raw}`)?.length).toBeGreaterThan(4);
    expect(decodePdfBytes(raw)?.length).toBeGreaterThan(4);
  });

  it('非 PDF 数据返回 null', () => {
    expect(decodePdfBytes(btoa('hello'))).toBeNull();
    expect(decodePdfBytes('not-base64!!!')).toBeNull();
  });
});

describe('刊级 PDF 上限', () => {
  it('上限为正整数', () => {
    expect(Number.isInteger(PRINT_MAX_TOTAL_PDF_PAGES)).toBe(true);
    expect(PRINT_MAX_TOTAL_PDF_PAGES).toBeGreaterThan(0);
  });
});
