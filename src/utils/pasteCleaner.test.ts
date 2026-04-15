import { describe, it, expect } from 'vitest';
import { cleanPastedHtml } from './pasteCleaner';

describe('pasteCleaner', () => {
  describe('标签净化', () => {
    it('移除 script 标签', () => {
      const html = '<div>内容<script>alert("xss")</script></div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('<script>');
      expect(result).toContain('内容');
    });

    it('移除 style 标签', () => {
      const html = '<div>内容<style>.class{color:red}</style></div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('<style>');
      expect(result).toContain('内容');
    });

    it('移除 iframe 标签', () => {
      const html = '<div>内容<iframe src="x"></iframe></div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('<iframe>');
    });

    it('移除 svg 和 canvas 标签', () => {
      const html = '<div><svg></svg><canvas></canvas></div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('<svg>');
      expect(result).not.toContain('<canvas>');
    });

    it('展开 section 标签', () => {
      const html = '<section><p>段落 1</p><p>段落 2</p></section>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('<section>');
      expect(result).toContain('段落 1');
      expect(result).toContain('段落 2');
    });

    it('展开 mpvoice 和 mpvideosnap 标签', () => {
      const html = '<mpvoice><p>内容</p></mpvoice>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('<mpvoice>');
      expect(result).toContain('内容');
    });
  });

  describe('样式净化', () => {
    it('移除 margin 和 padding 样式', () => {
      const html = '<div style="margin:10px; padding:20px; color:red;">内容</div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('margin:');
      expect(result).not.toContain('padding:');
      expect(result).toContain('内容');
    });

    it('移除 font-family 和 font-size', () => {
      const html = '<p style="font-size:16px; font-family:Arial;">文本</p>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('font-size');
      expect(result).not.toContain('font-family');
    });

    it('保留非敏感样式', () => {
      const html = '<div style="object-fit:cover; aspect-ratio:16/9;">内容</div>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('object-fit:cover');
    });

    it('完全移除只有敏感样式的 style 属性', () => {
      const html = '<div style="margin:0;"></div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('style=');
    });
  });

  describe('属性净化', () => {
    it('移除 id 属性', () => {
      const html = '<div id="myId">内容</div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('id=');
    });

    it('移除 data- 属性', () => {
      const html = '<div data-v-123="1" data-test="value">内容</div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('data-');
    });

    it('移除 class 属性', () => {
      const html = '<div class="my-class">内容</div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('class=');
    });

    it('保留富媒体空节点结构', () => {
      const html = '<div><img src="x.jpg"></div>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('<img');
      expect(result).toContain('x.jpg');
    });
  });

  describe('图片处理', () => {
    it('为图片添加 referrerpolicy 属性', () => {
      const html = '<img src="http://example.com/image.jpg">';
      const result = cleanPastedHtml(html);
      expect(result).toContain('referrerpolicy="no-referrer"');
    });

    it('修复协议相对 URL 的图片', () => {
      const html = '<img src="//example.com/image.jpg">';
      const result = cleanPastedHtml(html);
      expect(result).toContain('src="https://example.com/image.jpg"');
    });

    it('从富媒体容器中提取图片', () => {
      const html = '<div class="rich_pages"><img src="http://example.com/img.jpg"></div>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('referrerpolicy="no-referrer"');
      expect(result).not.toContain('rich_pages');
    });
  });

  describe('链接处理', () => {
    it('移除 javascript:伪协议的链接', () => {
      const html = '<a href="javascript:void(0)">点击</a>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('javascript:');
      expect(result).toContain('点击');
    });

    it('移除空锚点链接', () => {
      const html = '<a href="#">链接</a>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('href="#"');
      expect(result).toContain('链接');
    });

    it('保留正常链接', () => {
      const html = '<a href="http://example.com">链接</a>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('href="http://example.com"');
    });
  });

  describe('空节点处理', () => {
    it('删除纯空段落', () => {
      const html = '<p>   </p>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('<p>');
    });

    it('保留包含 br 的空节点', () => {
      const html = '<div>文本<br>换行</div>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('<br>');
    });

    it('保留包含图片的空节点', () => {
      const html = '<p><img src="test.jpg"></p>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('<img');
    });

    it('删除连续空段落', () => {
      const html = '<p></p><p></p><p>内容</p>';
      const result = cleanPastedHtml(html);
      expect((result.match(/<p>/g) || []).length).toBeLessThanOrEqual(1);
    });
  });

  describe('br 标签处理', () => {
    it('合并连续 br 标签', () => {
      const html = '<br><br><br>';
      const result = cleanPastedHtml(html);
      const brCount = (result.match(/<br>/g) || []).length;
      expect(brCount).toBeLessThanOrEqual(2);
    });

    it('替换多个 br 为单个段落', () => {
      const html = '<br><br><br><br>';
      const result = cleanPastedHtml(html);
      expect(result).not.toMatch(/<br>\s*<br>\s*<br>/);
    });
  });

  describe('文本节点包装', () => {
    it('包装裸文本到 p 标签', () => {
      const html = '纯文本内容';
      const result = cleanPastedHtml(html);
      expect(result).toContain('<p>');
      expect(result).toContain('纯文本内容');
    });

    it('混合内容包装', () => {
      const html = '文本 1<div>块级</div>文本 2';
      const result = cleanPastedHtml(html);
      expect(result).toContain('<p>文本 1</p>');
      expect(result).toContain('<div>块级</div>');
      expect(result).toContain('<p>文本 2</p>');
    });
  });

  describe('特殊标签处理', () => {
    it('移除包含特定 class 的容器但保留图片', () => {
      const html = '<div class="rich_pages wx_img_wrap"><img src="test.jpg"></div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('rich_pages');
      expect(result).toContain('<img');
    });

    it('移除 js_editor 和 js_pc_qr_code 类', () => {
      const html = '<div class="js_editor">内容</div>';
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('js_editor');
    });
  });

  describe('完整流程测试', () => {
    it('处理微信公众号文章 HTML', () => {
      const html = `
        <section>
          <div class="rich_pages">
            <p style="margin:10px; font-size:16px;">段落 1</p>
            <img src="//example.com/img.jpg" data-src="backup.jpg">
          </div>
          <script>alert("xss")</script>
        </section>
      `;
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('section');
      expect(result).not.toContain('rich_pages');
      expect(result).not.toContain('margin:');
      expect(result).not.toContain('<script>');
      expect(result).toContain('referrerpolicy="no-referrer"');
      expect(result).toContain('example.com/img.jpg');
    });

    it('处理复杂嵌套结构', () => {
      const html = `
        <mpvoice>
          <div id="wrapper" data-id="123">
            <p style="color:red;"><strong>加粗</strong></p>
            <a href="javascript:void(0)">链接</a>
          </div>
        </mpvoice>
      `;
      const result = cleanPastedHtml(html);
      expect(result).not.toContain('mpvoice');
      expect(result).not.toContain('id=');
      expect(result).not.toContain('data-');
      expect(result).not.toContain('javascript:');
      expect(result).toContain('<strong>加粗</strong>');
    });

    it('处理空输入', () => {
      const result = cleanPastedHtml('');
      expect(result).toBe('');
    });

    it('处理只有空白字符的输入', () => {
      const result = cleanPastedHtml('   \n\n  ');
      expect(result).toBe('');
    });
  });

  describe('边缘情况测试', () => {
    it('处理自关闭标签', () => {
      const html = '<div><br/><img src="test.jpg"/></div>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('<br>');
      expect(result).toContain('<img');
    });

    it('处理 HTML 实体', () => {
      const html = '<p>&nbsp;&amp;&lt;&gt;</p>';
      const result = cleanPastedHtml(html);
      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('处理 Unicode 空白字符', () => {
      const html = '<p>\u00A0\u00A0\u00A0</p>';
      const result = cleanPastedHtml(html);
      expect(result).toBe('');
    });
  });
});
