/**
 * 媒体库服务（P0-A 媒体资产拆表）
 *
 * 职责：
 * - 媒体记录的按需读取（带 LRU 内存缓存），供渲染/导出/AI 还原引用；
 * - 文章（或多篇）的引用还原：`sws-media://{hash}` → data URL；
 * - 引用计数全量重算（权威口径）；
 * - 旧库一次性迁移（幂等、可中断续跑）。
 *
 * 写侧抽取不在这里：落库统一走 `services/db.ts` 的写方法（先写媒体、再写文章）。
 */
import { db } from './db';
import type { Article } from '../src/types';
import { collectArticleMediaHashes, hasInlineMedia, resolveArticleMedia } from '../src/utils/mediaRefs';

const MIGRATION_KEY = 'config-mediaMigratedAt';
/** 内存缓存条目上限 */
const CACHE_MAX_ENTRIES = 32;
/** 内存缓存字符量上限（≈48MB），避免驻留过多媒体 */
const CACHE_MAX_CHARS = 48 * 1024 * 1024;

const dataUrlCache = new Map<string, string>();
let cachedChars = 0;

function cacheMedia(hash: string, dataUrl: string): void {
  const previous = dataUrlCache.get(hash);
  if (previous !== undefined) {
    cachedChars -= previous.length;
    dataUrlCache.delete(hash);
  }
  dataUrlCache.set(hash, dataUrl);
  cachedChars += dataUrl.length;

  while (dataUrlCache.size > CACHE_MAX_ENTRIES || (cachedChars > CACHE_MAX_CHARS && dataUrlCache.size > 1)) {
    const oldest = dataUrlCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cachedChars -= dataUrlCache.get(oldest)?.length ?? 0;
    dataUrlCache.delete(oldest);
  }
}

export function clearMediaDataCache(): void {
  dataUrlCache.clear();
  cachedChars = 0;
}

export function getMediaCacheStats(): { entries: number; chars: number } {
  return { entries: dataUrlCache.size, chars: cachedChars };
}

/** 取媒体 data URL（LRU 内存缓存 + 落库回源） */
export async function getMediaDataUrl(hash: string): Promise<string | null> {
  const cached = dataUrlCache.get(hash);
  if (cached !== undefined) {
    dataUrlCache.delete(hash);
    dataUrlCache.set(hash, cached); // LRU 提升
    return cached;
  }
  const record = await db.getMedia(hash);
  if (!record) return null;
  cacheMedia(hash, record.dataUrl);
  return record.dataUrl;
}

async function loadLookup(hashes: Iterable<string>): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  await Promise.all(Array.from(hashes).map(async (hash) => {
    const dataUrl = await getMediaDataUrl(hash);
    if (dataUrl) lookup.set(hash, dataUrl);
  }));
  return lookup;
}

/** 单个字符串字段的引用还原（非引用原样返回） */
export async function resolveMediaValue(value: string | null | undefined): Promise<string | null | undefined> {
  if (!value || !value.includes('sws-media://')) return value;
  const hashes = collectArticleMediaHashes(value);
  if (hashes.length === 0) return value;
  return resolveArticleMedia(value, await loadLookup(hashes));
}

/** 单篇文章的引用还原（导出/AI/PDF 等需要完整数据的场景前调用） */
export async function resolveArticleMediaData<T>(article: T): Promise<T> {
  const hashes = collectArticleMediaHashes(article);
  if (hashes.length === 0) return article;
  return resolveArticleMedia(article, await loadLookup(hashes));
}

/** 多篇文章的引用还原：共享一次 hash → dataUrl 查询，避免逐篇重复回源 */
export async function resolveArticlesMediaData<T>(articles: T[]): Promise<T[]> {
  const hashes = new Set<string>();
  for (const article of articles) {
    for (const hash of collectArticleMediaHashes(article)) hashes.add(hash);
  }
  if (hashes.size === 0) return articles;
  const lookup = await loadLookup(hashes);
  return articles.map(article => resolveArticleMedia(article, lookup));
}

export interface MediaMigrationResult {
  /** 本次处理的文章数 */
  migrated: number;
  /** 媒体库总条目数 */
  media: number;
  /** 已完成过迁移而跳过 */
  skipped: boolean;
}

export async function isMediaMigrationDone(): Promise<boolean> {
  const stamp = await db.load<number>(MIGRATION_KEY);
  return typeof stamp === 'number' && stamp > 0;
}

/**
 * 旧库一次性迁移：文章里的内联 base64 媒体 → `sws-media://` 引用 + media_store。
 * - 幂等、可中断续跑（完成标记在全部处理成功后才写；已迁移文章再次抽取为空操作）；
 * - 逐篇走 `db.saveArticle`（写侧保证先写媒体、再写文章）；
 * - 每 5 篇让出主线程，避免长任务卡顿。
 * ⚠️ 必须在编辑交互开始前完成（调用方在首屏加载阶段 await）。
 */
export async function migrateArticlesToMediaRefs(options?: {
  /** 调用方已加载的文章（避免二次全量读库） */
  articles?: Article[];
  onStart?: (total: number) => void;
  onProgress?: (done: number, total: number) => void;
}): Promise<MediaMigrationResult> {
  if (await isMediaMigrationDone()) return { migrated: 0, media: 0, skipped: true };

  const articles: Article[] = options?.articles ?? await db.getArticles();

  // 库里没有任何内联媒体（全新库 / 已迁移过）：直接落标记收工——不做全表重写、也不打扰用户
  if (!articles.some(hasInlineMedia)) {
    await db.save(MIGRATION_KEY, Date.now());
    const all = await db.getAllMedia();
    return { migrated: 0, media: all.length, skipped: true };
  }

  options?.onStart?.(articles.length);

  for (let i = 0; i < articles.length; i++) {
    await db.saveArticle(articles[i]);
    options?.onProgress?.(i + 1, articles.length);
    if ((i + 1) % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }

  await recalcMediaRefs();
  await db.save(MIGRATION_KEY, Date.now());
  const all = await db.getAllMedia();
  return { migrated: articles.length, media: all.length, skipped: false };
}

/**
 * 找出"文章引用了、但媒体库里没有"的 hash（悬空引用）。
 * 只读 key（`getAllKeys`），不拉取 payload，代价与媒体条数成正比而非体积。
 * 用途：导入含引用但无媒体的文件、媒体记录损坏时给出可见告警，
 * 避免导出产物把 `sws-media://` 带出去而用户毫无感知。
 */
export async function findMissingMediaHashes(articles: unknown[]): Promise<string[]> {
  const referenced = new Set<string>();
  for (const article of articles) {
    for (const hash of collectArticleMediaHashes(article)) referenced.add(hash);
  }
  if (referenced.size === 0) return [];

  const existing = new Set(await db.getMediaKeys());
  return Array.from(referenced).filter(hash => !existing.has(hash));
}

/**
 * 全量重算媒体引用计数（权威口径）。
 * `deleteOrphans` 首版默认关闭：只统计不物理删除，避免误删导致媒体不可恢复。
 */
export async function recalcMediaRefs(options?: {
  deleteOrphans?: boolean;
}): Promise<{ total: number; orphans: number; deleted: number }> {
  const articles = await db.getArticles();
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const hash of collectArticleMediaHashes(article)) {
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    }
  }

  const records = await db.getAllMedia();
  const orphans: string[] = [];
  const updated = records.map((record) => {
    const refCount = counts.get(record.hash) ?? 0;
    if (refCount === 0) orphans.push(record.hash);
    return { ...record, refCount };
  });
  await db.putMediaRecords(updated);

  let deleted = 0;
  if (options?.deleteOrphans && orphans.length > 0) {
    await db.deleteMedia(orphans);
    deleted = orphans.length;
  }
  return { total: records.length, orphans: orphans.length, deleted };
}
