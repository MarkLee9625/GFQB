const UNWRAP_TAGS = new Set(['section', 'mpvoice', 'mpvideosnap', 'mpcommon', 'mpa', 'mpprofile', 'mp-weixin']);
const REMOVE_TAGS = new Set(['script', 'style', 'noscript', 'iframe', 'svg', 'canvas']);
const PRESERVE_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'img', 'a', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'pre', 'code',
  'figure', 'figcaption',
  'video', 'audio', 'source',
]);
const STRIP_STYLE_PROPS = [
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'line-height', 'letter-spacing', 'text-indent',
  'font-size', 'font-family', 'font-weight', 'font-style',
  'color', 'background', 'background-color',
  'white-space', 'word-break', 'word-spacing',
  'visibility', 'overflow', 'opacity',
  'position', 'top', 'left', 'right', 'bottom', 'z-index',
  'float', 'clear', 'display',
  'border', 'border-radius',
  'box-shadow', 'text-shadow',
  'transform', 'transition', 'animation',
  'max-width', 'min-width', 'max-height', 'min-height',
  'vertical-align',
];

function stripInlineStyles(el: HTMLElement): void {
  const style = el.getAttribute('style');
  if (!style) return;

  const keep: string[] = [];
  for (const rule of style.split(';')) {
    const trimmed = rule.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = trimmed.substring(0, colonIdx).trim().toLowerCase();
    const shouldStrip = STRIP_STYLE_PROPS.some(sp =>
      prop === sp || prop.startsWith(sp + '-')
    );
    if (!shouldStrip) {
      keep.push(trimmed);
    }
  }

  if (keep.length > 0) {
    el.setAttribute('style', keep.join('; '));
  } else {
    el.removeAttribute('style');
  }
}

function isEmptyNode(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return !node.textContent || node.textContent.trim() === '' || node.textContent.trim() === '\u00A0';
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return false;
    if (tag === 'img') return false;
    const text = el.textContent || '';
    const hasOnlyWhitespace = text.trim() === '' || text.trim() === '\u00A0';
    const hasNoMedia = !el.querySelector('img, video, audio, iframe');
    return hasOnlyWhitespace && hasNoMedia;
  }
  return true;
}

function unwrapElement(el: Element, parent: Node): void {
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

function cleanNode(node: Node, parent: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (REMOVE_TAGS.has(tag)) {
    parent.removeChild(el);
    return;
  }

  if (UNWRAP_TAGS.has(tag)) {
    const children = Array.from(el.childNodes);
    unwrapElement(el, parent);
    children.forEach(child => {
      if (child.parentNode) cleanNode(child, child.parentNode);
    });
    return;
  }

  const classAttr = el.getAttribute('class') || '';
  if (classAttr.includes('rich_pages') || classAttr.includes('js_editor') ||
      classAttr.includes('__bg_gif') || classAttr.includes('js_uneditable') ||
      classAttr.includes('qr_code_pc') || classAttr.includes('js_pc_qr_code')) {
    if (el.querySelector('img')) {
      const imgs = el.querySelectorAll('img');
      for (const img of Array.from(imgs)) {
        img.setAttribute('referrerpolicy', 'no-referrer');
        parent.insertBefore(img, el);
      }
    }
    parent.removeChild(el);
    return;
  }

const DATA_ATTR_WHITELIST = new Set(['data-caption']);

  const attrsToRemove: string[] = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if ((attr.name.startsWith('data-') && !DATA_ATTR_WHITELIST.has(attr.name)) || attr.name === 'id' || attr.name === 'class') {
      attrsToRemove.push(attr.name);
    }
  }
  attrsToRemove.forEach(a => el.removeAttribute(a));

  stripInlineStyles(el);

  if (tag === 'img') {
    el.setAttribute('referrerpolicy', 'no-referrer');
    const src = el.getAttribute('src') || '';
    if (src.startsWith('//')) {
      el.setAttribute('src', 'https:' + src);
    }
    return;
  }

  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    if (href.toLowerCase().startsWith('javascript:') || href === '#') {
      unwrapElement(el, parent);
      return;
    }
    return;
  }

  const children = Array.from(el.childNodes);
  for (const child of children) {
    cleanNode(child, el);
  }

  if (!PRESERVE_TAGS.has(tag) && tag !== 'div' && tag !== 'span') {
    unwrapElement(el, parent);
    return;
  }

  if ((tag === 'p' || tag === 'div' || tag === 'span') && isEmptyNode(el)) {
    parent.removeChild(el);
  }
}

function collapseBrGroups(doc: Document): void {
  const body = doc.body;
  const brs = body.querySelectorAll('br');
  for (const br of Array.from(brs)) {
    const prev = br.previousElementSibling;
    if (prev && prev.tagName.toLowerCase() === 'br') {
      const p = doc.createElement('p');
      p.innerHTML = '<br>';
      br.parentNode!.insertBefore(p, br);
      prev.remove();
      br.remove();
    }
  }
}

function wrapBareTextNodes(doc: Document): void {
  const body = doc.body;
  const children = Array.from(body.childNodes);
  let currentP: HTMLParagraphElement | null = null;

  for (const node of children) {
    const isBlock = node.nodeType === Node.ELEMENT_NODE &&
      /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|FIGURE|TABLE|PRE|HR)$/i.test((node as HTMLElement).tagName);

    if (!isBlock) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (!text.trim() && !currentP) continue;
      }
      if (!currentP) {
        currentP = doc.createElement('p');
        body.insertBefore(currentP, node);
      }
      currentP.appendChild(node);
    } else {
      currentP = null;
    }
  }
}

function removeConsecutiveEmptyP(doc: Document): void {
  const body = doc.body;
  const allP = body.querySelectorAll('p');
  let lastWasEmpty = false;
  for (const p of Array.from(allP)) {
    const isEmpty = isEmptyNode(p);
    if (isEmpty && lastWasEmpty) {
      p.remove();
    } else {
      lastWasEmpty = isEmpty;
    }
  }
}

export function cleanPastedHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const body = doc.body;
  const children = Array.from(body.childNodes);
  for (const child of children) {
    cleanNode(child, body);
  }

  collapseBrGroups(doc);
  wrapBareTextNodes(doc);
  removeConsecutiveEmptyP(doc);

  let result = body.innerHTML;

  result = result.replace(/<p>\s*<br\s*\/?>\s*<\/p>\s*<p>\s*<br\s*\/?>\s*<\/p>/gi, '<p><br/></p>');
  result = result.replace(/(<p>\s*<br\s*\/?>\s*<\/p>\s*){3,}/gi, '<p><br/></p>');
  result = result.replace(/<p>\s*&nbsp;\s*<\/p>/gi, '');
  result = result.replace(/<p>\s*<\/p>/gi, '');

  return result.trim();
}
