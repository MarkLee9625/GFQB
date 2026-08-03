import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BlockRenderer } from './BlockRenderer';
import type {
  ContentBlock,
  TextBlock,
  HeadingBlock,
  ImageBlock,
  BlockquoteBlock,
  ListBlock,
  HrBlock,
  CodeBlock,
  FigureBlock,
  TableBlock,
} from '../../../types';

function makeBlock(overrides: Partial<ContentBlock> & { type: ContentBlock['type'] }): ContentBlock {
  return {
    id: 'blk-test',
    ...overrides,
  } as ContentBlock;
}

describe('BlockRenderer', () => {
  it('1: 渲染 heading-1 为 h1 标签', () => {
    const block = makeBlock({ type: 'heading', level: 1, content: '标题' }) as HeadingBlock;
    render(<BlockRenderer block={block} mode="read" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('标题');
  });

  it('2: 渲染 heading-2 为 h2 标签', () => {
    const block = makeBlock({ type: 'heading', level: 2, content: '标题' }) as HeadingBlock;
    render(<BlockRenderer block={block} mode="read" />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeTruthy();
  });

  it('3: 渲染 paragraph 为 p 标签', () => {
    const block = makeBlock({ type: 'paragraph', content: '正文' }) as TextBlock;
    render(<BlockRenderer block={block} mode="read" />);
    const para = screen.getByText('正文');
    expect(para.tagName.toLowerCase()).toBe('p');
  });

  it('4: 渲染 paragraph 含内联 HTML', () => {
    const block = makeBlock({ type: 'paragraph', content: '<b>粗</b>文本' }) as TextBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const p = container.querySelector('p');
    expect(p).toBeTruthy();
    expect(p?.innerHTML).toContain('<b>粗</b>');
  });

  it('5: 渲染 image 为 img 标签', () => {
    const block = makeBlock({ type: 'image', src: 'x.jpg', alt: '图' }) as ImageBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('alt')).toBe('图');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img?.getAttribute('decoding')).toBe('async');
  });

  it('6: 渲染 blockquote 为 blockquote 标签', () => {
    const block = makeBlock({ type: 'blockquote', content: '引用' }) as BlockquoteBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const bq = container.querySelector('blockquote');
    expect(bq).toBeTruthy();
    expect(bq?.textContent).toBe('引用');
  });

  it('7: 渲染 ordered list 为 ol 标签', () => {
    const block = makeBlock({ type: 'list', listType: 'ordered', items: ['A', 'B'] }) as ListBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const ol = container.querySelector('ol');
    expect(ol).toBeTruthy();
    const lis = container.querySelectorAll('li');
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe('A');
  });

  it('8: 渲染 unordered list 为 ul 标签', () => {
    const block = makeBlock({ type: 'list', listType: 'unordered', items: ['A'] }) as ListBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const ul = container.querySelector('ul');
    expect(ul).toBeTruthy();
  });

  it('9: 渲染 hr 为 hr 标签', () => {
    const block = makeBlock({ type: 'hr' }) as HrBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const hr = container.querySelector('hr');
    expect(hr).toBeTruthy();
  });

  it('10: 渲染 code 为 pre>code 标签', () => {
    const block = makeBlock({ type: 'code', content: 'code' }) as CodeBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    const code = container.querySelector('code');
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe('code');
  });

  it('11: 渲染 figure 为 figure>img+figcaption', () => {
    const block = makeBlock({
      type: 'figure',
      image: { src: 'x.jpg', alt: '图' },
      caption: '说明',
    }) as FigureBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const figure = container.querySelector('figure');
    expect(figure).toBeTruthy();
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    const caption = container.querySelector('figcaption');
    expect(caption?.textContent).toBe('说明');
  });

  it('12: 渲染 table 为 table 标签', () => {
    const block = makeBlock({
      type: 'table',
      rows: [['单元格1', '单元格2']],
    }) as TableBlock;
    const { container } = render(<BlockRenderer block={block} mode="read" />);
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    const tds = container.querySelectorAll('td');
    expect(tds.length).toBe(2);
  });

  it('13: heading-3 渲染为 h3 标签', () => {
    const block = makeBlock({ type: 'heading', level: 3, content: '三级标题' }) as HeadingBlock;
    render(<BlockRenderer block={block} mode="read" />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toBeTruthy();
  });

  it('14: print 模式下 image 直接渲染', () => {
    const block = makeBlock({ type: 'image', src: 'x.jpg', alt: '图' }) as ImageBlock;
    const { container } = render(<BlockRenderer block={block} mode="print" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
  });

  it('15: data URL 图片解码完成前不直接使用 base64 作为 src', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-image') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    try {
      const dataUrl = 'data:image/png;base64,' + btoa('iVBORw0KGgo=');
      const block = makeBlock({ type: 'image', src: dataUrl, alt: '图' }) as ImageBlock;
      const { container } = render(<BlockRenderer block={block} mode="print" />);
      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toBeNull();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(img?.getAttribute('src')).toBe('blob:mock-image');
    } finally {
      URL.createObjectURL = originalCreate as typeof URL.createObjectURL;
      URL.revokeObjectURL = originalRevoke as typeof URL.revokeObjectURL;
    }
  });
});
