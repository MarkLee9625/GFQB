import type { Article } from '../types';

/**
 * 按优先级排序文章：
 * 封面（category='封面'）在最前，封底（category='封底'）在最后，
 * 其余文章按 order 字段升序排列。
 */
export function sortArticlesByPriority(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => {
    if (a.category === '封面') return -1;
    if (b.category === '封面') return 1;
    if (a.category === '封底') return 1;
    if (b.category === '封底') return -1;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}
