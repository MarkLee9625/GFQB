import { useCallback, useMemo, useRef } from 'react';
import type { Article } from '../src/types';
import { filterArticlesByQuery } from '../src/utils/articleFilter';

interface UseArticleNavigationOptions {
  articles: Article[];
  currentId: number | null;
  searchQuery: string;
  setCurrentId: (id: number | null) => void;
  setIsImmersive: (v: boolean) => void;
  setIsSidebarHidden: React.Dispatch<React.SetStateAction<boolean>>;
  contentScrollRef: React.RefObject<HTMLDivElement | null>;
}

export function useArticleNavigation({
  articles,
  currentId,
  searchQuery,
  setCurrentId,
  setIsImmersive,
  setIsSidebarHidden,
  contentScrollRef,
}: UseArticleNavigationOptions) {
  // 空查询返回原数组引用，下游 memo 引用稳定；标题缺失的脏数据按空标题处理（见 articleFilter）
  const sortedArticles = useMemo(() => filterArticlesByQuery(articles, searchQuery), [articles, searchQuery]);

  const articlesRef = useRef(articles);
  articlesRef.current = articles;

  const handleSelectArticle = useCallback((id: number | string) => {
    const numId = Number(id);
    setCurrentId(numId);
    const art = articlesRef.current.find(a => a.id === numId);
    const isSpecial = art?.category === '封面' || art?.category === '封底';

    if (isSpecial) {
      setIsImmersive(true);
      setIsSidebarHidden(true);
    } else {
      setIsImmersive(false);
      setIsSidebarHidden(false);
    }

    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [setCurrentId, setIsImmersive, setIsSidebarHidden, contentScrollRef]);

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    const idx = sortedArticles.findIndex(a => a.id === currentId);
    if (direction === 'prev' && idx > 0) {
      handleSelectArticle(sortedArticles[idx - 1].id);
    } else if (direction === 'next' && idx > -1 && idx < sortedArticles.length - 1) {
      handleSelectArticle(sortedArticles[idx + 1].id);
    }
  }, [sortedArticles, currentId, handleSelectArticle]);

  return {
    sortedArticles,
    handleSelectArticle,
    handleNavigate,
  };
}
