import type { Article } from '../types';

/** 归一化搜索关键字：去首尾空白并统一小写，memo 键稳定 */
export function normalizeArticleQuery(query: string): string {
    return (query ?? '').trim().toLowerCase();
}

/**
 * 标题命中判定（空安全）。
 * 说明：历史实现直接 `a.title.toLowerCase()`，导入的脏数据缺 title 时会抛异常；
 * 此处按空标题处理（空查询全量通过，非空查询不命中），行为其余不变（仅匹配 title）。
 */
export function matchesArticleQuery(article: Article, normalizedQuery: string): boolean {
    if (!normalizedQuery) return true;
    const title = article.title ?? '';
    return title.toLowerCase().includes(normalizedQuery);
}

/**
 * 按关键字过滤文章列表。
 * 空查询直接返回原数组引用（内容与 filter 全量结果一致），保持下游 useMemo/memo 引用稳定，
 * 避免每次 keystroke 都产生新数组导致 Sidebar/导航 memo 失效。
 */
export function filterArticlesByQuery(articles: Article[], query: string): Article[] {
    const q = normalizeArticleQuery(query);
    if (!q) return articles;
    return articles.filter(a => matchesArticleQuery(a, q));
}
