import { cleanPastedHtml } from './pasteCleaner';
import type {
  ContentBlock,
  BlockType,
  TextBlock,
  HeadingBlock,
  ImageBlock,
  VideoBlock,
  AudioBlock,
  BlockquoteBlock,
  ListBlock,
  TableBlock,
  CodeBlock,
  HrBlock,
  FigureBlock,
  RawHtmlBlock,
  HeadingLevel,
  ListType,
} from '../types';

const INLINE_TAGS = new Set([
  'b', 'i', 'a', 'strong', 'em', 'u', 's', 'code', 'br',
  'del', 'ins', 'sub', 'sup', 'span',
]);

const MEDIA_TAGS = new Set(['img', 'video', 'audio', 'figure']);

const BLOCK_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'blockquote', 'ul', 'ol', 'pre', 'hr',
  'table', 'figure', 'img', 'video', 'audio',
]);

const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav']);

const RAW_HTML_CONTAINER_CLASSES = [
  'knowledge-graph-container',
  'media-container',
];

function generateBlockId(index: number, type: BlockType, content: string): string {
  const raw = `${index}:${type}:${content.slice(0, 64)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `blk-${Math.abs(hash).toString(36)}`;
}

function extractInlineHtml(el: Element): string {
  const parts: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      parts.push(child.textContent || '');
    } else if (child.nodeType === 1) {
      const childEl = child as Element;
      const tag = childEl.tagName.toLowerCase();
      if (INLINE_TAGS.has(tag)) {
        if (tag === 'br') {
          parts.push('<br>');
        } else {
          const clone = childEl.cloneNode(false) as Element;
          clone.innerHTML = extractInlineHtml(childEl);
          parts.push(clone.outerHTML);
        }
      } else {
        parts.push(extractInlineHtml(childEl));
      }
    }
  }
  return parts.join('');
}

function serializeInlineElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') return '<br>';
  const clone = el.cloneNode(false) as Element;
  clone.innerHTML = extractInlineHtml(el);
  return clone.outerHTML;
}

function isEmptyContent(content: string): boolean {
  const stripped = content.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim();
  return stripped === '';
}

function parseHeading(el: Element, index: number): HeadingBlock {
  const tag = el.tagName.toLowerCase();
  const level = parseInt(tag[1], 10) as HeadingLevel;
  const content = extractInlineHtml(el);
  return {
    id: generateBlockId(index, 'heading', content),
    type: 'heading',
    level,
    content,
  };
}

function parseImage(el: Element, index: number): ImageBlock {
  const src = el.getAttribute('src') || '';
  const alt = el.getAttribute('alt') || undefined;
  const caption = el.getAttribute('data-caption') || undefined;
  return {
    id: generateBlockId(index, 'image', src),
    type: 'image',
    src,
    alt,
    caption,
  };
}

function parseVideo(el: Element, index: number): VideoBlock {
  let src = el.getAttribute('src') || '';
  if (!src) {
    const source = el.querySelector('source');
    if (source) src = source.getAttribute('src') || '';
  }
  return {
    id: generateBlockId(index, 'video', src),
    type: 'video',
    src,
  };
}

function parseAudio(el: Element, index: number): AudioBlock {
  let src = el.getAttribute('src') || '';
  if (!src) {
    const source = el.querySelector('source');
    if (source) src = source.getAttribute('src') || '';
  }
  return {
    id: generateBlockId(index, 'audio', src),
    type: 'audio',
    src,
  };
}

function parseBlockquote(el: Element, index: number): BlockquoteBlock {
  const content = extractInlineHtml(el);
  return {
    id: generateBlockId(index, 'blockquote', content),
    type: 'blockquote',
    content,
  };
}

function parseList(el: Element, index: number): ListBlock {
  const tag = el.tagName.toLowerCase();
  const listType: ListType = tag === 'ol' ? 'ordered' : 'unordered';
  const items: string[] = [];
  const lis = el.querySelectorAll(':scope > li');
  for (const li of Array.from(lis)) {
    items.push(extractInlineHtml(li));
  }
  const contentKey = items.join('|');
  return {
    id: generateBlockId(index, 'list', contentKey),
    type: 'list',
    listType,
    items,
  };
}

function parseTable(el: Element, index: number): TableBlock {
  const rows: string[][] = [];
  const trs = el.querySelectorAll('tr');
  for (const tr of Array.from(trs)) {
    const cells: string[] = [];
    const tds = tr.querySelectorAll('td, th');
    for (const td of Array.from(tds)) {
      cells.push(extractInlineHtml(td));
    }
    if (cells.length > 0) rows.push(cells);
  }
  const contentKey = rows.map(r => r.join('|')).join('||');
  return {
    id: generateBlockId(index, 'table', contentKey),
    type: 'table',
    rows,
  };
}

function parseCode(el: Element, index: number): CodeBlock {
  const codeEl = el.querySelector('code');
  const content = codeEl ? codeEl.textContent || '' : el.textContent || '';
  const language = codeEl?.className?.replace('language-', '').replace('hljs', '').trim() || undefined;
  return {
    id: generateBlockId(index, 'code', content),
    type: 'code',
    content,
    language: language || undefined,
  };
}

function parseFigure(el: Element, index: number): FigureBlock {
  const imgEl = el.querySelector('img');
  const captionEl = el.querySelector('figcaption');
  const src = imgEl?.getAttribute('src') || '';
  const alt = imgEl?.getAttribute('alt') || undefined;
  const caption = captionEl?.textContent?.trim() || undefined;
  return {
    id: generateBlockId(index, 'figure', src + (caption || '')),
    type: 'figure',
    image: { src, alt },
    caption,
  };
}

function parseMediaElement(el: Element, index: number): ContentBlock | null {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'img': return parseImage(el, index);
    case 'video': return parseVideo(el, index);
    case 'audio': return parseAudio(el, index);
    case 'figure': return parseFigure(el, index);
    default: return null;
  }
}

function hasMediaChildren(el: Element): boolean {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (MEDIA_TAGS.has(tag)) return true;
  }
  return false;
}

function flushTextBuffer(buffer: string[], results: ContentBlock[], indexCounter: { value: number }): void {
  const joined = buffer.join('');
  if (isEmptyContent(joined)) return;
  const idx = indexCounter.value++;
  results.push({
    id: generateBlockId(idx, 'paragraph', joined),
    type: 'paragraph',
    content: joined,
  });
}

function parseParagraph(el: Element, index: number, results: ContentBlock[], indexCounter: { value: number }): void {
  if (hasMediaChildren(el)) {
    const textBuffer: string[] = [];

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1) {
        const childEl = child as Element;
        const tag = childEl.tagName.toLowerCase();
        if (MEDIA_TAGS.has(tag)) {
          flushTextBuffer(textBuffer, results, indexCounter);
          textBuffer.length = 0;
          const idx = indexCounter.value++;
          const block = parseMediaElement(childEl, idx);
          if (block) results.push(block);
        } else if (INLINE_TAGS.has(tag)) {
          if (tag === 'br') {
            textBuffer.push('<br>');
          } else {
            textBuffer.push(serializeInlineElement(childEl));
          }
        } else {
          const content = extractInlineHtml(childEl);
          textBuffer.push(content);
        }
      } else if (child.nodeType === 3) {
        const text = child.textContent || '';
        if (text.trim()) {
          textBuffer.push(text);
        }
      }
    }

    flushTextBuffer(textBuffer, results, indexCounter);
    return;
  }

  const content = extractInlineHtml(el);
  if (isEmptyContent(content)) return;
  results.push({
    id: generateBlockId(index, 'paragraph', content),
    type: 'paragraph',
    content,
  });
}

function parseNode(node: Node, results: ContentBlock[], indexCounter: { value: number }): void {
  if (node.nodeType === 3) {
    const text = node.textContent?.trim();
    if (text) {
      const idx = indexCounter.value++;
      results.push({
        id: generateBlockId(idx, 'paragraph', text),
        type: 'paragraph',
        content: text,
      });
    }
    return;
  }

  if (node.nodeType !== 1) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (BLOCK_TAGS.has(tag)) {
    const idx = indexCounter.value++;

    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        results.push(parseHeading(el, idx));
        break;
      case 'p':
        parseParagraph(el, idx, results, indexCounter);
        break;
      case 'img':
        results.push(parseImage(el, idx));
        break;
      case 'video':
        results.push(parseVideo(el, idx));
        break;
      case 'audio':
        results.push(parseAudio(el, idx));
        break;
      case 'blockquote':
        results.push(parseBlockquote(el, idx));
        break;
      case 'ul': case 'ol':
        results.push(parseList(el, idx));
        break;
      case 'table':
        results.push(parseTable(el, idx));
        break;
      case 'pre':
        results.push(parseCode(el, idx));
        break;
      case 'hr':
        results.push({ id: generateBlockId(idx, 'hr', 'hr'), type: 'hr' } as HrBlock);
        break;
      case 'figure':
        results.push(parseFigure(el, idx));
        break;
    }
  } else if (CONTAINER_TAGS.has(tag)) {
    const classAttr = el.getAttribute('class') || '';
    const isRawHtmlContainer = RAW_HTML_CONTAINER_CLASSES.some(cls => classAttr.includes(cls));
    if (isRawHtmlContainer) {
      const idx = indexCounter.value++;
      results.push({
        id: generateBlockId(idx, 'rawHtml', el.outerHTML),
        type: 'rawHtml',
        html: el.outerHTML,
      } as RawHtmlBlock);
    } else {
      for (const child of Array.from(el.childNodes)) {
        parseNode(child, results, indexCounter);
      }
    }
  } else if (tag === 'span') {
    const text = el.textContent?.trim();
    if (text) {
      const idx = indexCounter.value++;
      const content = extractInlineHtml(el);
      if (!isEmptyContent(content)) {
        results.push({
          id: generateBlockId(idx, 'paragraph', content),
          type: 'paragraph',
          content,
        });
      }
    }
  } else if (INLINE_TAGS.has(tag)) {
    const idx = indexCounter.value++;
    const content = extractInlineHtml(el);
    if (!isEmptyContent(content)) {
      results.push({
        id: generateBlockId(idx, 'paragraph', content),
        type: 'paragraph',
        content,
      });
    }
  }
}

export function htmlToBlocks(html: string): ContentBlock[] {
  if (!html || !html.trim()) return [];

  const hasRawHtmlContainers = RAW_HTML_CONTAINER_CLASSES.some(cls => html.includes(cls));

  let cleaned: string;
  if (hasRawHtmlContainers) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const containers = doc.querySelectorAll(RAW_HTML_CONTAINER_CLASSES.map(c => '.' + c).join(','));
    const preservedMap = new Map<Element, string>();
    containers.forEach((container, i) => {
      const marker = `__RAW_HTML_PRESERVE_${i}__`;
      preservedMap.set(container, marker);
      const placeholder = doc.createElement('div');
      placeholder.setAttribute('data-preserve-marker', marker);
      placeholder.innerHTML = marker;
      try {
        if (container.parentNode) {
          container.parentNode.replaceChild(placeholder, container);
        }
      } catch {
        // 嵌套容器可能已被替换，跳过
      }
    });

    const tempHtml = doc.body.innerHTML;
    const cleanedTemp = cleanPastedHtml(tempHtml);

    let result = cleanedTemp;
    preservedMap.forEach((marker, container) => {
      const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedMarker, 'g'), container.outerHTML);
    });
    cleaned = result;
  } else {
    cleaned = cleanPastedHtml(html);
  }

  if (!cleaned || !cleaned.trim()) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, 'text/html');

  const results: ContentBlock[] = [];
  const indexCounter = { value: 0 };

  for (const child of Array.from(doc.body.childNodes)) {
    parseNode(child, results, indexCounter);
  }

  return results.filter(block => {
    if (block.type === 'paragraph') {
      return !isEmptyContent((block as TextBlock).content);
    }
    return true;
  });
}
