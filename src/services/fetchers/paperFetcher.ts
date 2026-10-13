import type { UniversalArticleMeta } from '../../types';
import { fetchWithTimeout } from './utils';

/**
 * 论文抓取（多引擎）
 *
 * 引擎 1：OpenAlex REST API 直连（官方支持 CORS，免 key）
 * 引擎 2：BFF 代理 → arXiv API（arXiv 无 CORS 头，必须走 BFF）
 *
 * 降档策略（对齐 rssFetcher 思路）：
 * - 首页检索：引擎 1 挂掉或零结果 → 引擎 2 兜底；两者都挂才报错
 * - 续页（加载更多）：仅引擎 1 支持游标分页，续页失败直接抛错
 */

export const PAPER_KEYWORDS = [
  { label: 'Shipbuilding', value: 'shipbuilding' },
  { label: 'Offshore Platform', value: 'offshore platform' },
  { label: 'Marine Engineering', value: 'marine engineering' },
  { label: 'Ship Design', value: 'ship design' },
  { label: 'Welding Technology', value: 'welding ship steel' },
  { label: 'Shipbuilding Robot', value: 'shipbuilding welding robot' },
  { label: 'Green Ship', value: 'green ship propulsion' },
];

export type PaperSort = 'relevance' | 'cited' | 'recent';
/** '1' | '3' | '5' 表示近 N 年；'all' 不限 */
export type PaperYearRange = 'all' | '1' | '3' | '5';

export interface PaperSearchParams {
  keyword: string;
  yearRange?: PaperYearRange;
  sort?: PaperSort;
  /** OpenAlex 游标分页：首页不传（内部用 '*'），续页传上一次返回的 nextCursor */
  cursor?: string;
}

export interface PaperSearchResult {
  articles: UniversalArticleMeta[];
  /** null 表示没有更多（arXiv 兜底源或已到 OpenAlex 末页） */
  nextCursor: string | null;
}

const OPENALEX_ENDPOINT = 'https://api.openalex.org/works';
const PER_PAGE = 25;
/** 摘要质量门槛：低于该长度的条目默认过滤（过滤后为空则回退保留原结果，避免空页死局） */
export const MIN_ABSTRACT_CHARS = 100;

// OpenAlex polite pool：填入自己的邮箱可提额降风控，留空则匿名访问
const CONTACT_EMAIL = '';

/* ============================== OpenAlex 类型 ============================== */

interface OpenAlexAuthorship {
  author?: { display_name?: string };
}
interface OpenAlexLocation {
  source?: { display_name?: string } | null;
}
export interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string;
  publication_year?: number | null;
  publication_date?: string | null;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: OpenAlexAuthorship[];
  primary_location?: OpenAlexLocation | null;
  open_access?: { oa_url?: string | null };
}
interface OpenAlexResponse {
  results?: OpenAlexWork[];
  meta?: { next_cursor?: string | null };
}

/* ============================== 纯函数（可测） ============================== */

/** abstract_inverted_index（词 → 位置数组）按位置还原成完整摘要段落 */
export function rebuildAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index || typeof index !== 'object') return '';
  const positioned: { pos: number; word: string }[] = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) positioned.push({ pos, word });
  }
  positioned.sort((a, b) => a.pos - b.pos);
  return positioned.map((p) => p.word).join(' ').trim();
}

/** DOI 归一化：去 https://doi.org/ 前缀，只留裸 DOI */
export function normalizeDoi(doi: string | null | undefined): string {
  if (!doi) return '';
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
}

/** 去重键：优先 DOI，其次 URL，最后归一化标题 */
export function paperDedupeKey(a: UniversalArticleMeta): string {
  if (a.doi) return `doi:${a.doi.toLowerCase()}`;
  if (a.url) {
    return `url:${a.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase()}`;
  }
  return `title:${a.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ').trim()}`;
}

/** 按 DOI/URL/标题去重；existing 为已有条目（跨次检索防重复追加） */
export function dedupePapers(
  list: UniversalArticleMeta[],
  existing: UniversalArticleMeta[] = [],
): UniversalArticleMeta[] {
  const seen = new Set(existing.map(paperDedupeKey));
  const out: UniversalArticleMeta[] = [];
  for (const item of list) {
    const key = paperDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** 摘要质量门槛；若过滤后一条不剩（源数据普遍缺摘要），回退保留原结果避免空页 */
export function filterPapersByQuality(list: UniversalArticleMeta[]): UniversalArticleMeta[] {
  const qualified = list.filter((a) => (a.abstract?.length ?? 0) >= MIN_ABSTRACT_CHARS);
  return qualified.length > 0 ? qualified : list;
}

/** OpenAlex 单条 → UniversalArticleMeta；无标题返回 null */
export function mapOpenAlexWork(work: OpenAlexWork): UniversalArticleMeta | null {
  const title = (work.title || work.display_name || '').trim();
  if (!title) return null;

  const abstract = rebuildAbstract(work.abstract_inverted_index);
  const authors = (work.authorships || [])
    .map((a) => a?.author?.display_name?.trim() || '')
    .filter(Boolean);
  const journal = work.primary_location?.source?.display_name?.trim() || '';
  const year = work.publication_year ?? undefined;
  const citationCount = work.cited_by_count ?? 0;
  const doi = normalizeDoi(work.doi);
  const url = doi ? `https://doi.org/${doi}` : (work.open_access?.oa_url || work.id || '');

  const sourceBits = ['OpenAlex'];
  if (journal) sourceBits.push(journal);
  if (year) sourceBits.push(String(year));
  sourceBits.push(`被引 ${citationCount}`);

  const contentLines = [
    `期刊/来源: ${journal || '未标注'}`,
    authors.length > 0
      ? `作者: ${authors.slice(0, 8).join(', ')}${authors.length > 8 ? ' 等' : ''}`
      : '',
    `年份: ${year ?? '未知'} | 被引: ${citationCount}${doi ? ` | DOI: ${doi}` : ''}`,
    abstract ? `摘要: ${abstract}` : '',
  ].filter(Boolean);

  return {
    id: `paper-${Math.random().toString(36).substring(2, 11)}`,
    sourceType: 'paper',
    sourceName: sourceBits.join(' · '),
    title,
    content: contentLines.join('\n'),
    abstract,
    authors,
    journal: journal || undefined,
    year,
    citationCount,
    doi: doi || undefined,
    url,
    publishDate: work.publication_date || (year ? String(year) : new Date().toISOString()),
    decision: 'pending',
  };
}

/** arXiv Atom XML → UniversalArticleMeta[]（BFF 代理返回体解析） */
export function parseArxivFeed(xmlText: string): UniversalArticleMeta[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('arXiv 返回的 XML 无法解析');
  }

  const items: UniversalArticleMeta[] = [];
  for (const entry of Array.from(doc.querySelectorAll('entry'))) {
    const title = (entry.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!title) continue;
    const abstract = (entry.querySelector('summary')?.textContent || '').replace(/\s+/g, ' ').trim();
    const url = (entry.querySelector('id')?.textContent || '').trim();
    const published = (entry.querySelector('published')?.textContent || '').trim();
    const authors = Array.from(entry.querySelectorAll('author > name'))
      .map((n) => n.textContent?.trim() || '')
      .filter(Boolean);

    const contentLines = [
      '期刊/来源: arXiv 预印本',
      authors.length > 0
        ? `作者: ${authors.slice(0, 8).join(', ')}${authors.length > 8 ? ' 等' : ''}`
        : '',
      published ? `提交时间: ${published.slice(0, 10)}` : '',
      abstract ? `摘要: ${abstract}` : '',
    ].filter(Boolean);

    items.push({
      id: `paper-${Math.random().toString(36).substring(2, 11)}`,
      sourceType: 'paper',
      sourceName: 'arXiv',
      title,
      content: contentLines.join('\n'),
      abstract,
      authors,
      url,
      publishDate: published || new Date().toISOString(),
      decision: 'pending',
    });
  }
  return items;
}

/** 年份范围 → from_publication_date（ISO 日期），'all' 返回 null */
export function yearRangeFromDate(range: PaperYearRange = 'all'): string | null {
  if (range === 'all') return null;
  const years = Number(range);
  if (!Number.isFinite(years) || years <= 0) return null;
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** 组装 OpenAlex 检索 URL（导出便于测试断言参数） */
export function buildOpenAlexUrl(params: PaperSearchParams): string {
  const sp = new URLSearchParams();
  sp.set('search', params.keyword.trim());
  sp.set('per_page', String(PER_PAGE));

  const from = yearRangeFromDate(params.yearRange);
  if (from) sp.set('filter', `from_publication_date:${from}`);

  const sortMap: Record<PaperSort, string> = {
    relevance: 'relevance_score:desc',
    cited: 'cited_by_count:desc',
    recent: 'publication_date:desc',
  };
  sp.set('sort', sortMap[params.sort || 'relevance']);
  sp.set('cursor', params.cursor || '*');
  if (CONTACT_EMAIL) sp.set('mailto', CONTACT_EMAIL);

  return `${OPENALEX_ENDPOINT}?${sp.toString()}`;
}

/* ============================== 引擎实现 ============================== */

async function searchOpenAlex(params: PaperSearchParams): Promise<PaperSearchResult> {
  const url = buildOpenAlexUrl(params);
  const response = await fetchWithTimeout(url, 20000);
  if (!response.ok) throw new Error(`OpenAlex HTTP ${response.status}`);
  const data = (await response.json()) as OpenAlexResponse;
  const mapped = (data.results || [])
    .map(mapOpenAlexWork)
    .filter((a): a is UniversalArticleMeta => a !== null);
  return { articles: mapped, nextCursor: data.meta?.next_cursor || null };
}

async function searchArxivViaBff(keyword: string): Promise<UniversalArticleMeta[]> {
  const url = `/api/papers/search?source=arxiv&q=${encodeURIComponent(keyword)}&max_results=20`;
  let response: Response;
  try {
    response = await fetchWithTimeout(url, 20000);
  } catch {
    throw new Error('BFF 代理不可达：请用 npm run dev:all 启动 BFF 后重试');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`arXiv 代理检索失败 (HTTP ${response.status}) ${detail.substring(0, 120)}`);
  }
  const data = (await response.json()) as { ok?: boolean; xml?: string };
  if (!data.ok || !data.xml) throw new Error('arXiv 代理返回异常');
  return parseArxivFeed(data.xml);
}

/**
 * 主入口：多引擎论文检索
 * - 首页（无 cursor）：OpenAlex 优先，挂掉/零结果时 arXiv 兜底，合并去重 + 质量门槛
 * - 续页（有 cursor）：仅 OpenAlex 游标翻页
 */
export async function searchPapers(params: PaperSearchParams): Promise<PaperSearchResult> {
  const keyword = params.keyword.trim();
  if (!keyword) throw new Error('检索关键词不能为空');

  const isLoadMore = Boolean(params.cursor);

  let openAlexResult: PaperSearchResult | null = null;
  let openAlexError: Error | null = null;
  try {
    openAlexResult = await searchOpenAlex({ ...params, keyword, cursor: params.cursor || '*' });
  } catch (err) {
    openAlexError = err instanceof Error ? err : new Error(String(err));
  }

  // 续页：只走 OpenAlex，失败直接抛（首页已保证有兜底）
  if (isLoadMore) {
    if (!openAlexResult) throw openAlexError || new Error('OpenAlex 续页失败');
    return {
      articles: filterPapersByQuality(openAlexResult.articles),
      nextCursor: openAlexResult.nextCursor,
    };
  }

  const collected: UniversalArticleMeta[] = openAlexResult ? [...openAlexResult.articles] : [];

  if (collected.length === 0) {
    try {
      const arxivItems = await searchArxivViaBff(keyword);
      collected.push(...arxivItems);
    } catch (arxivError) {
      const arxivMsg = arxivError instanceof Error ? arxivError.message : String(arxivError);
      if (!openAlexResult) {
        const oaMsg = openAlexError ? openAlexError.message : '无返回';
        throw new Error(`论文检索失败 —— OpenAlex: ${oaMsg}；arXiv: ${arxivMsg}`);
      }
      // OpenAlex 正常但零结果，arXiv 也挂：返回空列表而非报错
      console.warn('[paperFetcher] arXiv 兜底失败（OpenAlex 零结果）:', arxivMsg);
    }
  }

  const deduped = dedupePapers(collected);
  console.log(
    `[paperFetcher] 检索 "${keyword}" 命中 ${deduped.length} 篇（OpenAlex ${openAlexResult?.articles.length ?? 0} / 兜底 ${Math.max(0, collected.length - (openAlexResult?.articles.length ?? 0))}）`,
  );
  return {
    articles: filterPapersByQuality(deduped),
    nextCursor: openAlexResult?.nextCursor ?? null,
  };
}
