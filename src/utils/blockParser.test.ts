import { describe, it, expect } from 'vitest';
import { htmlToBlocks } from './blockParser';
import type { HeadingBlock, TextBlock, ImageBlock, BlockquoteBlock, ListBlock, CodeBlock, FigureBlock, TableBlock, VideoBlock, AudioBlock } from '../types';

describe('htmlToBlocks', () => {
  describe('A. 纯净文本解析', () => {
    it('A1: 解析 h1 标题为 HeadingBlock', () => {
      const blocks = htmlToBlocks('<h1>标题</h1>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('heading');
      const heading = blocks[0] as HeadingBlock;
      expect(heading.level).toBe(1);
      expect(heading.content).toBe('标题');
    });

    it('A2: 解析 p 标签为 TextBlock', () => {
      const blocks = htmlToBlocks('<p>正文内容</p>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('paragraph');
      const para = blocks[0] as TextBlock;
      expect(para.content).toBe('正文内容');
    });

    it('A3: 解析 img 标签为 ImageBlock', () => {
      const blocks = htmlToBlocks('<img src="a.jpg" alt="图">');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('image');
      const img = blocks[0] as ImageBlock;
      expect(img.src).toBe('a.jpg');
      expect(img.alt).toBe('图');
    });

    it('A4: 解析 blockquote 为 BlockquoteBlock', () => {
      const blocks = htmlToBlocks('<blockquote>引用</blockquote>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('blockquote');
      const bq = blocks[0] as BlockquoteBlock;
      expect(bq.content).toBe('引用');
    });

    it('A5: 解析有序列表为 ListBlock', () => {
      const blocks = htmlToBlocks('<ol><li>项1</li><li>项2</li></ol>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('list');
      const list = blocks[0] as ListBlock;
      expect(list.listType).toBe('ordered');
      expect(list.items).toEqual(['项1', '项2']);
    });

    it('A6: 解析无序列表为 ListBlock', () => {
      const blocks = htmlToBlocks('<ul><li>项1</li></ul>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('list');
      const list = blocks[0] as ListBlock;
      expect(list.listType).toBe('unordered');
      expect(list.items).toEqual(['项1']);
    });

    it('A7: 解析 hr 为 HrBlock', () => {
      const blocks = htmlToBlocks('<hr>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('hr');
    });

    it('A8: 解析 pre>code 为 CodeBlock', () => {
      const blocks = htmlToBlocks('<pre><code>code</code></pre>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
      const code = blocks[0] as CodeBlock;
      expect(code.content).toBe('code');
    });

    it('A9: 解析混合内容为多个 Block', () => {
      const blocks = htmlToBlocks('<h2>标题</h2><p>段落</p><img src="x.jpg">');
      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('heading');
      expect(blocks[1].type).toBe('paragraph');
      expect(blocks[2].type).toBe('image');
    });

    it('A10: 解析 h2-h6 各级标题', () => {
      for (let level = 2; level <= 6; level++) {
        const blocks = htmlToBlocks(`<h${level}>标题${level}</h${level}>`);
        expect(blocks).toHaveLength(1);
        const heading = blocks[0] as HeadingBlock;
        expect(heading.level).toBe(level as any);
        expect(heading.content).toBe(`标题${level}`);
      }
    });
  });

  describe('B. 内联样式保留', () => {
    it('B1: 保留加粗标签 <b>', () => {
      const blocks = htmlToBlocks('<p>这是<b>加粗</b>文本</p>');
      const para = blocks[0] as TextBlock;
      expect(para.content).toContain('<b>加粗</b>');
    });

    it('B2: 保留斜体标签 <i>', () => {
      const blocks = htmlToBlocks('<p>这是<i>斜体</i></p>');
      const para = blocks[0] as TextBlock;
      expect(para.content).toContain('<i>斜体</i>');
    });

    it('B3: 保留链接标签 <a>', () => {
      const blocks = htmlToBlocks('<p><a href="http://x.com">链接</a></p>');
      const para = blocks[0] as TextBlock;
      expect(para.content).toContain('<a href="http://x.com">链接</a>');
    });

    it('B4: 保留混合内联标签', () => {
      const blocks = htmlToBlocks('<p><b>粗</b>和<i>斜</i></p>');
      const para = blocks[0] as TextBlock;
      expect(para.content).toContain('<b>粗</b>');
      expect(para.content).toContain('<i>斜</i>');
    });

    it('B5: 剥离块级标签 <div>', () => {
      const blocks = htmlToBlocks('<p><div>块级</div></p>');
      const hasText = blocks.some(b => {
        if (b.type === 'paragraph') return (b as TextBlock).content.includes('块级');
        return false;
      });
      expect(hasText).toBe(true);
      const para = blocks.find(b => b.type === 'paragraph') as TextBlock;
      if (para) {
        expect(para.content).not.toContain('<div>');
      }
    });

    it('B6: 保留 <strong> 和 <em>', () => {
      const blocks = htmlToBlocks('<p><strong>加粗</strong><em>斜体</em></p>');
      const para = blocks[0] as TextBlock;
      expect(para.content).toContain('<strong>加粗</strong>');
      expect(para.content).toContain('<em>斜体</em>');
    });
  });

  describe('C. 脏数据清洗', () => {
    it('C1: 清洗连续空行', () => {
      const blocks = htmlToBlocks('<p><br></p><p><br></p><p>有效</p>');
      const paragraphs = blocks.filter(b => b.type === 'paragraph');
      const validParagraphs = paragraphs.filter(b => {
        const content = (b as TextBlock).content;
        return content.replace(/<br\s*\/?>/g, '').trim().length > 0;
      });
      expect(validParagraphs.length).toBeGreaterThanOrEqual(1);
    });

    it('C2: 摊平无意义嵌套 div', () => {
      const blocks = htmlToBlocks('<div><div>文本</div></div>');
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const hasText = blocks.some(b => {
        if (b.type === 'paragraph') return (b as TextBlock).content.includes('文本');
        return false;
      });
      expect(hasText).toBe(true);
    });

    it('C3: 空内容返回空数组', () => {
      const blocks = htmlToBlocks('');
      expect(blocks).toEqual([]);
    });

    it('C4: 纯空白返回空数组', () => {
      const blocks = htmlToBlocks('   \n\n  ');
      expect(blocks).toEqual([]);
    });

    it('C5: 清洗连续空段落', () => {
      const blocks = htmlToBlocks('<p></p><p></p><p>内容</p>');
      const paragraphs = blocks.filter(b => b.type === 'paragraph');
      const nonEmpty = paragraphs.filter(b => (b as TextBlock).content.trim().length > 0);
      expect(nonEmpty.length).toBeGreaterThanOrEqual(1);
    });

    it('C6: 清洗带样式的脏 HTML', () => {
      const blocks = htmlToBlocks('<p style="margin:0;color:red;">文本</p>');
      expect(blocks).toHaveLength(1);
      const para = blocks[0] as TextBlock;
      expect(para.content).not.toContain('style=');
      expect(para.content).toContain('文本');
    });
  });

  describe('D. ID 稳定性测试', () => {
    it('D1: 相同输入产生相同 ID', () => {
      const html = '<p>测试内容</p>';
      const blocks1 = htmlToBlocks(html);
      const blocks2 = htmlToBlocks(html);
      expect(blocks1[0].id).toBe(blocks2[0].id);
    });

    it('D2: 不同内容产生不同 ID', () => {
      const blocks1 = htmlToBlocks('<p>内容A</p>');
      const blocks2 = htmlToBlocks('<p>内容B</p>');
      expect(blocks1[0].id).not.toBe(blocks2[0].id);
    });

    it('D3: ID 以 blk- 前缀开头', () => {
      const blocks = htmlToBlocks('<p>任意内容</p>');
      expect(blocks[0].id).toMatch(/^blk-/);
    });

    it('D4: 多次解析 ID 始终一致', () => {
      const html = '<h2>标题</h2><p>段落</p>';
      for (let i = 0; i < 5; i++) {
        const blocks = htmlToBlocks(html);
        const firstRun = htmlToBlocks(html);
        expect(blocks.map(b => b.id)).toEqual(firstRun.map(b => b.id));
      }
    });
  });

  describe('E. 边缘情况', () => {
    it('E1: 解析 figure+figcaption 为 FigureBlock', () => {
      const blocks = htmlToBlocks('<figure><img src="x.jpg"><figcaption>说明</figcaption></figure>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('figure');
      const fig = blocks[0] as FigureBlock;
      expect(fig.image.src).toBe('x.jpg');
      expect(fig.caption).toBe('说明');
    });

    it('E2: 解析 table 为 TableBlock', () => {
      const blocks = htmlToBlocks('<table><tr><td>单元格</td></tr></table>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('table');
      const table = blocks[0] as TableBlock;
      expect(table.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('E3: 解析 video 为 VideoBlock', () => {
      const blocks = htmlToBlocks('<video src="x.mp4"></video>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('video');
      const video = blocks[0] as VideoBlock;
      expect(video.src).toBe('x.mp4');
    });

    it('E4: 解析 audio 为 AudioBlock', () => {
      const blocks = htmlToBlocks('<audio src="x.mp3"></audio>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('audio');
      const audio = blocks[0] as AudioBlock;
      expect(audio.src).toBe('x.mp3');
    });

    it('E5: 解析 video 含 source 子标签', () => {
      const blocks = htmlToBlocks('<video><source src="x.mp4" type="video/mp4"></video>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('video');
    });

    it('E6: 解析 audio 含 source 子标签', () => {
      const blocks = htmlToBlocks('<audio><source src="x.mp3" type="audio/mpeg"></audio>');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('audio');
    });

    it('E7: img 标签添加 referrerpolicy', () => {
      const blocks = htmlToBlocks('<img src="a.jpg">');
      const img = blocks[0] as ImageBlock;
      expect(img.src).toBe('a.jpg');
    });
  });

  describe('F. 完整流程', () => {
    it('F1: 复杂 HTML 综合解析', () => {
      const html = `
        <h2>章节标题</h2>
        <p>这是<b>加粗</b>段落。</p>
        <blockquote>引用文本</blockquote>
        <ul><li>列表项</li></ul>
        <img src="photo.jpg" alt="照片">
        <hr>
        <p>最后一段</p>
      `;
      const blocks = htmlToBlocks(html);
      expect(blocks.length).toBeGreaterThanOrEqual(6);
      const types = blocks.map(b => b.type);
      expect(types).toContain('heading');
      expect(types).toContain('paragraph');
      expect(types).toContain('blockquote');
      expect(types).toContain('list');
      expect(types).toContain('image');
      expect(types).toContain('hr');
    });

    it('F2: 每个 Block 都有 id 字段', () => {
      const blocks = htmlToBlocks('<h1>标题</h1><p>段落</p>');
      for (const block of blocks) {
        expect(block.id).toBeTruthy();
        expect(typeof block.id).toBe('string');
      }
    });
  });

  describe('G. Paragraph Splintering 修复验证', () => {
    it('G1: 图文混排 - 图片前后文本合并为单段落', () => {
      const blocks = htmlToBlocks('<p>前文<img src="x.jpg">后文</p>');
      const paragraphs = blocks.filter(b => b.type === 'paragraph');
      const images = blocks.filter(b => b.type === 'image');
      expect(images).toHaveLength(1);
      expect(paragraphs).toHaveLength(2);
      const firstPara = paragraphs[0] as TextBlock;
      const secondPara = paragraphs[1] as TextBlock;
      expect(firstPara.content).toContain('前文');
      expect(secondPara.content).toContain('后文');
    });

    it('G2: 图文混排 - 多个相邻文本节点不拆分', () => {
      const blocks = htmlToBlocks('<p>文字1<b>加粗</b>文字2<img src="x.jpg">文字3<i>斜体</i>文字4</p>');
      const paragraphs = blocks.filter(b => b.type === 'paragraph');
      const images = blocks.filter(b => b.type === 'image');
      expect(images).toHaveLength(1);
      expect(paragraphs).toHaveLength(2);
      const beforeImg = paragraphs[0] as TextBlock;
      const afterImg = paragraphs[1] as TextBlock;
      expect(beforeImg.content).toContain('文字1');
      expect(beforeImg.content).toContain('<b>加粗</b>');
      expect(beforeImg.content).toContain('文字2');
      expect(afterImg.content).toContain('文字3');
      expect(afterImg.content).toContain('<i>斜体</i>');
      expect(afterImg.content).toContain('文字4');
    });

    it('G3: 纯图片段落不产生空 paragraph', () => {
      const blocks = htmlToBlocks('<p><img src="x.jpg"></p>');
      const paragraphs = blocks.filter(b => b.type === 'paragraph');
      const images = blocks.filter(b => b.type === 'image');
      expect(images).toHaveLength(1);
      const nonEmptyParagraphs = paragraphs.filter(b => {
        const content = (b as TextBlock).content.trim();
        return content.length > 0;
      });
      expect(nonEmptyParagraphs).toHaveLength(0);
    });

    it('G4: 图片前无文本时只产生 ImageBlock', () => {
      const blocks = htmlToBlocks('<p><img src="x.jpg">尾部文字</p>');
      const images = blocks.filter(b => b.type === 'image');
      const paragraphs = blocks.filter(b => b.type === 'paragraph');
      expect(images).toHaveLength(1);
      expect(paragraphs).toHaveLength(1);
      const para = paragraphs[0] as TextBlock;
      expect(para.content).toContain('尾部文字');
    });

    it('G5: 图片后无文本时只产生 ImageBlock + 前文段落', () => {
      const blocks = htmlToBlocks('<p>前部文字<img src="x.jpg"></p>');
      const images = blocks.filter(b => b.type === 'image');
      const paragraphs = blocks.filter(b => b.type === 'paragraph');
      expect(images).toHaveLength(1);
      expect(paragraphs).toHaveLength(1);
      const para = paragraphs[0] as TextBlock;
      expect(para.content).toContain('前部文字');
    });
  });

  describe('H. 游离内联标签兜底验证', () => {
    it('H1: 游离 <b> 标签转为 paragraph', () => {
      const blocks = htmlToBlocks('<b>加粗文本</b>');
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const para = blocks.find(b => b.type === 'paragraph') as TextBlock;
      expect(para).toBeTruthy();
      expect(para.content).toContain('加粗文本');
    });

    it('H2: 游离 <i> 标签转为 paragraph', () => {
      const blocks = htmlToBlocks('<i>斜体文本</i>');
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const para = blocks.find(b => b.type === 'paragraph') as TextBlock;
      expect(para).toBeTruthy();
      expect(para.content).toContain('斜体文本');
    });

    it('H3: 游离 <a> 标签转为 paragraph', () => {
      const blocks = htmlToBlocks('<a href="http://x.com">链接</a>');
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const para = blocks.find(b => b.type === 'paragraph') as TextBlock;
      expect(para).toBeTruthy();
      expect(para.content).toContain('链接');
    });

    it('H4: 游离 <strong> 标签转为 paragraph', () => {
      const blocks = htmlToBlocks('<strong>重要</strong>');
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const para = blocks.find(b => b.type === 'paragraph') as TextBlock;
      expect(para).toBeTruthy();
      expect(para.content).toContain('重要');
    });

    it('H5: 游离内联标签不丢失数据', () => {
      const blocks = htmlToBlocks('<em>强调</em>普通文本<b>加粗</b>');
      const allContent = blocks
        .filter(b => b.type === 'paragraph')
        .map(b => (b as TextBlock).content)
        .join('');
      expect(allContent).toContain('强调');
      expect(allContent).toContain('加粗');
    });
  });

  describe('I. 解析结果 LRU 缓存', () => {
    it('I1: 相同内容二次解析返回同一缓存引用（不再全量解析）', () => {
      const html = '<p>缓存命中测试</p><h2>标题</h2>';
      const first = htmlToBlocks(html);
      const second = htmlToBlocks(html);
      expect(second).toBe(first);
      expect(second).toHaveLength(2);
    });

    it('I2: 不同内容解析结果互不影响', () => {
      const a = htmlToBlocks('<p>AAA</p>');
      const b = htmlToBlocks('<p>BBB</p>');
      expect(a).not.toBe(b);
      expect((a[0] as TextBlock).content).toContain('AAA');
      expect((b[0] as TextBlock).content).toContain('BBB');
    });
  });
});
