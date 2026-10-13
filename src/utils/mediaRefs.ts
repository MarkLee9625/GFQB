/**
 * 媒体引用协议（P0-A 媒体资产拆表）
 *
 * 背景：正文 HTML / blocks / 封面封底 / PDF 中的 base64 data URL 会与文章正文一起整篇读写，
 * 造成存储双份（content + blocks）、修改标题也要重写数 MB、启动全量加载。
 *
 * 约定：媒体统一抽到 IndexedDB `media_store`，文章里只保留引用 `sws-media://{hash}`。
 * - 本模块是**纯函数层**（不碰 IndexedDB）：哈希、抽取、收集、还原；
 * - 落库与查库见 `services/db.ts` 与 `services/mediaStore.ts`。
 *
 * 哈希口径：总长度 + 头/中/尾各 8KB 采样窗口的 FNV-1a（128 位十六进制）。
 * 大文件（30MB PDF）无需全量遍历；128 位采样哈希下真实内容碰撞概率可忽略，
 * 写库侧对"同 hash 不同内容"采取**保留原记录 + 告警**（不改写、不加后缀），
 * 以保证引用可复现（见 db.putMediaIfAbsent）。
 */
import type { Article } from '../types';

export const MEDIA_REF_SCHEME = 'sws-media://';

export interface MediaRecord {
  hash: string;
  dataUrl: string;
  mime: string;
  size: number;
  /** 引用计数（权威口径由 mediaStore.recalcMediaRefs 全量重算） */
  refCount: number;
  createdAt: number;
}

/** 待入库的媒体（refCount/createdAt 由写库侧补） */
export type ExtractedMedia = Omit<MediaRecord, 'refCount' | 'createdAt'>;

/** base64 形态的 data URL（应用内媒体统一为 base64；非 base64 的 data URL 不抽取，保持原样） */
function newDataUrlPattern(): RegExp {
  return /data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9.+-]+=[a-zA-Z0-9.+-]*)*;base64,[A-Za-z0-9+/=]+/g;
}

function newMediaRefPattern(): RegExp {
  return /sws-media:\/\/([0-9a-f]{8,64})/g;
}

export function makeMediaRef(hash: string): string {
  return MEDIA_REF_SCHEME + hash;
}

export function isMediaRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(MEDIA_REF_SCHEME);
}

export function mediaHashFromRef(ref: string): string | null {
  if (!isMediaRef(ref)) return null;
  const hash = ref.slice(MEDIA_REF_SCHEME.length);
  return /^[0-9a-f]{8,64}$/.test(hash) ? hash : null;
}

/** data URL 的 MIME（`data:image/webp;base64,...` → `image/webp`） */
export function mimeOfDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+)/.exec(dataUrl);
  return match ? match[1] : 'application/octet-stream';
}

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV 素数 16777619 的 32 位乘法
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

const SAMPLE_WINDOW = 8192;

/** 内容哈希：长度 + 头/中/尾采样窗口（128 位十六进制） */
export function hashDataUrl(dataUrl: string): string {
  const len = dataUrl.length;
  const head = dataUrl.slice(0, SAMPLE_WINDOW);
  const midStart = Math.max(0, (len >> 1) - (SAMPLE_WINDOW >> 1));
  const mid = len > 2 * SAMPLE_WINDOW ? dataUrl.slice(midStart, midStart + SAMPLE_WINDOW) : '';
  const tail = len > SAMPLE_WINDOW ? dataUrl.slice(-SAMPLE_WINDOW) : '';

  const h1 = fnv1a(head, 0x811c9dc5);
  const h2 = fnv1a(mid, (0x9e3779b9 ^ h1) >>> 0);
  const h3 = fnv1a(tail, (0x85ebca6b ^ h2) >>> 0);
  const h4 = fnv1a(`${len}:${mimeOfDataUrl(dataUrl)}`, (0xc2b2ae35 ^ h3) >>> 0);

  return [h1, h2, h3, h4].map(v => v.toString(16).padStart(8, '0')).join('');
}

/** 深度遍历对象/数组，对字符串字段执行 transform（值未变化时保留原引用） */
function mapStrings(value: unknown, transform: (s: string) => string): unknown {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map(item => {
      const result = mapStrings(item, transform);
      if (result !== item) changed = true;
      return result;
    });
    return changed ? next : value;
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      const result = mapStrings(source[key], transform);
      if (result !== source[key]) changed = true;
      next[key] = result;
    }
    return changed ? next : value;
  }
  return value;
}

/**
 * 抽取字符串中的内联 media data URL → 引用。
 * 单字段本身即 data URL（coverImage/pdfData 等）同样适用。
 */
export function extractMediaFromString(text: string): { text: string; media: ExtractedMedia[] } {
  if (!text.includes('data:') || !text.includes(';base64,')) return { text, media: [] };

  const media: ExtractedMedia[] = [];
  const seen = new Set<string>();
  const replaced = text.replace(newDataUrlPattern(), (dataUrl) => {
    const hash = hashDataUrl(dataUrl);
    if (!seen.has(hash)) {
      seen.add(hash);
      media.push({ hash, dataUrl, mime: mimeOfDataUrl(dataUrl), size: dataUrl.length });
    }
    return makeMediaRef(hash);
  });

  return { text: replaced, media };
}

/**
 * 抽取文章内全部媒体（正文内联图 + blocks + 封面封底 + PDF）→ 引用。
 * 纯函数：不写库，返回瘦身后的文章与待入库媒体清单。
 */
export function extractArticleMedia<T extends Record<string, unknown>>(
  article: T
): { article: T; media: ExtractedMedia[] } {
  const media = new Map<string, ExtractedMedia>();
  const replace = (text: string): string => {
    const result = extractMediaFromString(text);
    for (const item of result.media) {
      if (!media.has(item.hash)) media.set(item.hash, item);
    }
    return result.text;
  };

  const next = mapStrings(article, replace) as T;
  return { article: next, media: Array.from(media.values()) };
}

/** 收集文章中引用的媒体 hash（去重） */
export function collectArticleMediaHashes(article: unknown): string[] {
  const hashes = new Set<string>();
  const collect = (text: string): string => {
    if (!text.includes(MEDIA_REF_SCHEME)) return text;
    const pattern = newMediaRefPattern();
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) hashes.add(match[1]);
    return text;
  };

  mapStrings(article, collect);
  return Array.from(hashes);
}

/** 用 hash → dataUrl 映射把引用还原为 data URL（导出/AI/PDF 等需要完整数据的场景） */
export function resolveArticleMedia<T>(article: T, lookup: Map<string, string>): T {
  const restore = (text: string): string => {
    if (!text.includes(MEDIA_REF_SCHEME)) return text;
    return text.replace(newMediaRefPattern(), (ref, hash: string) => lookup.get(hash) ?? ref);
  };
  return mapStrings(article, restore) as T;
}

/** 判断文章（或其字段）是否含内联媒体，用于迁移前的快速跳过 */
export function hasInlineMedia(article: Article): boolean {
  let found = false;
  const detect = (text: string): string => {
    if (!found && text.includes('data:') && text.includes(';base64,')) found = true;
    return text;
  };
  mapStrings(article, detect);
  return found;
}
