import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fileToDataURL, compressImage, base64ToBlob, parseMarkdownToHtml } from './fileHelpers';

describe('fileHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fileToDataURL', () => {
    it('成功转换文件为 DataURL', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockReader = {
        result: 'data:text/plain;base64,dGVzdA==',
        onload: null as any,
        onerror: null as any,
        onabort: null as any,
        readAsDataURL: vi.fn(function(this: any) {
          setTimeout(() => {
            this.onload({ target: { result: this.result } });
          }, 0);
        })
      };

      vi.stubGlobal('FileReader', class {
        constructor() {
          Object.assign(this, mockReader);
        }
      });

      const result = await fileToDataURL(mockFile);
      expect(result).toBe('data:text/plain;base64,dGVzdA==');
    });

    it('文件为空时抛出错误', async () => {
      await expect(fileToDataURL(null as any)).rejects.toThrow('文件为空');
    });

    it('视频文件超过 50MB 抛出错误', async () => {
      const largeVideoFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'video.mp4', { type: 'video/mp4' });
      await expect(fileToDataURL(largeVideoFile)).rejects.toThrow('视频');
    });

    it('图片文件超过 10MB 抛出错误', async () => {
      const largeImageFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'image.png', { type: 'image/png' });
      await expect(fileToDataURL(largeImageFile)).rejects.toThrow('11.00');
    });

    it('PDF 文件超过 30MB 抛出错误', async () => {
      const largePdfFile = new File([new ArrayBuffer(31 * 1024 * 1024)], 'document.pdf', { type: 'application/pdf' });
      await expect(fileToDataURL(largePdfFile)).rejects.toThrow('文件');
    });

    it('读取失败时抛出错误', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      vi.stubGlobal('FileReader', class {
        result = null;
        onload: any = null;
        onerror: any = null;
        readAsDataURL() {
          setTimeout(() => {
            this.onerror({ target: { error: new Error('读取失败') } });
          }, 0);
        }
      });

      await expect(fileToDataURL(mockFile)).rejects.toThrow('文件读取失败');
    });

    it('读取被中止时抛出错误', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      vi.stubGlobal('FileReader', class {
        result = null;
        onload: any = null;
        onabort: any = null;
        readAsDataURL() {
          setTimeout(() => {
            this.onabort();
          }, 0);
        }
      });

      await expect(fileToDataURL(mockFile)).rejects.toThrow('文件读取被中止');
    });

    it('读取结果不是字符串时抛出错误', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      vi.stubGlobal('FileReader', class {
        result = new ArrayBuffer(100);
        onload: any = null;
        readAsDataURL() {
          setTimeout(() => {
            this.onload({ target: { result: this.result } });
          }, 0);
        }
      });

      await expect(fileToDataURL(mockFile)).rejects.toThrow('文件读取结果不是字符串');
    });
  });

  describe('compressImage', () => {
    it('压缩图片成功', async () => {
      vi.stubGlobal('Image', class {
        width = 1600;
        height = 1200;
        crossOrigin = '';
        private _src = '';
        onload: any = null;
        onerror: any = null;
        
        set src(value: string) {
          this._src = value;
          setTimeout(() => this.onload?.(), 10);
        }
        get src() {
          return this._src;
        }
      });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
          drawImage: vi.fn()
        })),
        toDataURL: vi.fn(() => 'data:image/webp;base64,compressed'),
        parentNode: null
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as any);

      const result = await compressImage('data:image/png;base64,test', 1200, 0.8, 'webp');
      expect(result).toContain('data:image/webp');
    }, 10000);

    it('图片数据为空时抛出错误', async () => {
      await expect(compressImage('', 1200, 0.8)).rejects.toThrow('图片数据为空');
    });

    it('图片宽度小于 50 且高度小于 50 时直接返回', async () => {
      vi.stubGlobal('Image', class {
        width = 40;
        height = 40;
        crossOrigin = '';
        private _src = '';
        onload: any = null;
        onerror: any = null;
        
        set src(value: string) {
          this._src = value;
          setTimeout(() => this.onload?.(), 10);
        }
        get src() {
          return this._src;
        }
      });

      const result = await compressImage('data:image/png;base64,test', 1200, 0.8);
      expect(result).toBe('data:image/png;base64,test');
    }, 10000);

    it('不需要压缩且格式为 original 时直接返回', async () => {
      vi.stubGlobal('Image', class {
        width = 800;
        height = 600;
        crossOrigin = '';
        private _src = '';
        onload: any = null;
        onerror: any = null;
        
        set src(value: string) {
          this._src = value;
          setTimeout(() => this.onload?.(), 0);
        }
        get src() {
          return this._src;
        }
      });

      const result = await compressImage('data:image/png;base64,test', 1200, 0.8, 'original');
      expect(result).toBe('data:image/png;base64,test');
    }, 10000);

    it('压缩失败时降级到 JPEG', async () => {
      vi.stubGlobal('Image', class {
        width = 800;
        height = 600;
        crossOrigin = '';
        private _src = '';
        onload: any = null;
        onerror: any = null;
        
        set src(value: string) {
          this._src = value;
          setTimeout(() => this.onload?.(), 0);
        }
        get src() {
          return this._src;
        }
      });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
          drawImage: vi.fn()
        })),
        toDataURL: vi.fn().mockImplementation((mime: string) => {
          if (mime === 'image/webp') {
            throw new Error('WebP 不支持');
          }
          return 'data:image/jpeg;base64,compressed';
        }),
        parentNode: null
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as any);

      const result = await compressImage('data:image/png;base64,test', 1200, 0.8, 'webp');
      expect(result).toContain('data:image/jpeg');
    }, 10000);
  });

  describe('base64ToBlob', () => {
    it('转换 base64 为 Blob', () => {
      const base64 = 'data:text/plain;base64,dGVzdA==';
      const blob = base64ToBlob(base64);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/plain');
    });

    it('输入为空时返回空 Blob', () => {
      const blob = base64ToBlob('');
      expect(blob.size).toBe(0);
    });

    it('格式无效时返回空 Blob', () => {
      const blob = base64ToBlob('invalid-base64');
      expect(blob.size).toBe(0);
    });

    it('base64 数据为空时返回空 Blob', () => {
      const blob = base64ToBlob('data:text/plain;base64,');
      expect(blob.size).toBe(0);
    });

    it('base64 解码失败时返回空 Blob', () => {
      const blob = base64ToBlob('data:text/plain;base64,!!!invalid!!!');
      expect(blob.size).toBe(0);
    });

    it('没有 MIME 类型时返回空 Blob', () => {
      const base64 = 'base64data';
      const blob = base64ToBlob(base64);
      expect(blob.size).toBe(0);
    });
  });

  describe('parseMarkdownToHtml', () => {
    it('转换标题', () => {
      const md = '# 标题 1\n## 标题 2\n### 标题 3';
      const html = parseMarkdownToHtml(md);
      expect(html).toContain('<h1>标题 1</h1>');
      expect(html).toContain('<h2>标题 2</h2>');
      expect(html).toContain('<h3>标题 3</h3>');
    });

    it('转换加粗和斜体', () => {
      const md = '**加粗** *斜体*';
      const html = parseMarkdownToHtml(md);
      expect(html).toContain('<strong>加粗</strong>');
      expect(html).toContain('<em>斜体</em>');
    });

    it('转换图片', () => {
      const md = '![描述](http://example.com/image.png)';
      const html = parseMarkdownToHtml(md);
      expect(html).toContain('<img src="http://example.com/image.png"');
      expect(html).toContain('referrerpolicy="no-referrer"');
    });

    it('转换链接', () => {
      const md = '[链接](http://example.com)';
      const html = parseMarkdownToHtml(md);
      expect(html).toContain('<a href="http://example.com"');
      expect(html).toContain('target="_blank"');
    });

    it('转换段落', () => {
      const md = '段落 1\n\n段落 2';
      const html = parseMarkdownToHtml(md);
      expect(html).toContain('<p');
      expect(html).toContain('段落 1');
      expect(html).toContain('段落 2');
    });

    it('空字符串返回空字符串', () => {
      const html = parseMarkdownToHtml('');
      expect(html).toBe('');
    });
  });
});
