import { useState, useEffect, useCallback, useRef } from 'react';
import type { Article } from '../src/types';
import { db } from '../services/db';
import { sortArticlesByPriority } from '../src/utils/articleSort';
import { parseEmbeddedData } from '../src/utils/embeddedData';
import { toast } from '../src/utils/toast';

export function useJournal() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const idCounterRef = useRef(0);
  const mountedRef = useRef(true);


  // 集中式清洗函数：确保所有文章数据的 id 和 order 都是数字类型
  const sanitizeArticles = useCallback((list: Article[]): Article[] => {
    return list.map((a, index) => {
      const numId = Number(a.id);
      // 修复：如果 ID 是 NaN 或 0，生成一个新的临时 ID，防止“僵尸”文章无法操作
      const safeId = (!isNaN(numId) && numId !== 0) ? numId : Date.now() + index;

      return {
        ...a,
        id: safeId,
        order: Number(a.order) || 0
      };
    });
  }, []);

  // 初始化加载
  useEffect(() => {
    const abortController = new AbortController();
    mountedRef.current = true;
    async function load() {
      const aborted = () => !mountedRef.current || abortController.signal.aborted;

      // Reader 模式优先：嵌入数据存在时直接使用，跳过 IndexedDB 加载，
      // 避免与 useAppInitialization 的写入竞争导致旧库数据覆盖嵌入数据。
      // 导出端数据为 gzip 压缩（compression.ts），必须按 __SWS_COMPRESSION_METHOD__
      // 在 Worker 中解压后再 JSON.parse，直接 decodeB64Utf8 会解析失败。
      const embedded = window.__SWS_DATA_ARTICLES_B64__;
      if (embedded) {
        try {
          const method = window.__SWS_COMPRESSION_METHOD__;
          const jsonData = await parseEmbeddedData<Article[]>(embedded, method);
          if (aborted()) return;
          if (!Array.isArray(jsonData)) {
            throw new Error('嵌入式文章数据格式不正确');
          }
          const data = sanitizeArticles(jsonData);
          setArticles(sortArticlesByPriority(data));
          if (data.length > 0) setCurrentId(data[0].id);
        } catch (e) {
          console.error('Reader embedded data parse failed', e);
          if (mountedRef.current) {
            toast.error('阅读版数据加载失败：' + (e instanceof Error ? e.message : '未知错误'));
          }
        } finally {
          if (mountedRef.current) setLoading(false);
        }
        return;
      }

      try {
        await db.init();
        if (aborted()) return;

        const rawData = await db.getArticles();
        if (aborted()) return;
        const data = sanitizeArticles(rawData);

        if (data.length === 0) {
          const now = Date.now();
          const fresh: Article[] = [
            { id: now, title: "封面", category: "封面", content: "", issueText: "NO.01", dateText: "JAN " + new Date().getFullYear(), order: 0 },
            { id: now + 1, title: "封底", category: "封底", content: "", order: 99999 }
          ];
          await db.clearAndBulkSaveArticles(fresh);
          if (aborted()) return;
          setArticles(fresh);
          setCurrentId(fresh[0].id);
        } else {
          const ordered = sortArticlesByPriority(data);
          if (aborted()) return;
          setArticles(ordered);
          if (ordered.length > 0) setCurrentId(ordered[0].id);
        }
      } catch (e) {
        console.error('Failed to load articles', e);
        if (mountedRef.current) {
          toast.error('数据加载失败：' + (e instanceof Error ? e.message : '未知错误'));
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    load();
    return () => {
      mountedRef.current = false;
      abortController.abort();
    };
  }, [sanitizeArticles]);

  // 按文章 id 分桶防抖：不同文章的保存互不取消（单一 debounce 实例会清掉前一篇的保存导致丢失）
  const saveTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const debouncedSaveArticle = useCallback((article: Article) => {
    const id = Number(article.id);
    const timers = saveTimersRef.current;

    const existing = timers.get(id);
    if (existing) clearTimeout(existing);

    timers.set(id, setTimeout(async () => {
      timers.delete(id);
      try {
        await db.saveArticle(article);
      } catch (e) {
        console.error('Save failed', e);
        toast.error('文章保存失败，请稍后重试');
      }
    }, 1000));
  }, []);

  const updateArticle = useCallback((id: number, updates: Partial<Article>) => {
    const numId = Number(id);
    setArticles(prev => {
      const idx = prev.findIndex(a => a.id === numId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...updates };
      debouncedSaveArticle(updated);
      const next = [...prev];
      next[idx] = updated;

      if (updates.category !== undefined) {
        const oldCategory = prev[idx].category;
        if (updates.category === '封面' || updates.category === '封底' ||
            oldCategory === '封面' || oldCategory === '封底') {
          return sortArticlesByPriority(next);
        }
      }
      return next;
    });
  }, [debouncedSaveArticle]);

  const articlesRef = useRef(articles);
  articlesRef.current = articles;

  const createArticle = useCallback(async (articleData: Partial<Article>) => {
    const maxOrder = articlesRef.current.length > 0
      ? articlesRef.current.reduce((max, a) => Math.max(max, Number(a.order) || 0), 0)
      : 0;

    // 移除 articleData 中可能存在的无效 id，确保不覆盖 Date.now()
    const { id: _, ...restData } = articleData;

    const newArt: Article = {
      ...restData,
      id: Date.now() * 1000 + (++idCounterRef.current),
      title: restData.title || '无标题',
      category: restData.category || '工艺工法',
      content: restData.content || '',
      abstract: restData.abstract || '',
      order: maxOrder + 1000,
    };
    try {
      await db.saveArticle(newArt);
      setArticles(prev => sortArticlesByPriority([...prev, newArt]));
      setCurrentId(newArt.id);
      return newArt;
    } catch (e) {
      console.error('Create failed', e);
      toast.error('文章创建失败，请重试');
    }
  }, []);

  const deleteArticle = useCallback(async (id: number) => {
    const art = articlesRef.current.find(a => String(a.id) === String(id));

    if (art?.category === '封面' || art?.category === '封底') { toast.warning('封面和封底不可删除'); return; }
    if (!window.confirm('确定要删除这篇文章吗？')) return;

    try {
      await db.deleteArticle(id);

      setArticles(prev => {
        const next = prev.filter(a => String(a.id) !== String(id));
        return sortArticlesByPriority(next);
      });

      setCurrentId(prev => prev === id ? null : prev);
    } catch (e) {
      console.error('Delete failed', e);
      toast.error('文章删除失败，请重试');
    }
  }, []);

  const reorderArticles = useCallback((newArticles: Article[]) => {
    // 核心修复：根据拖拽后的新顺序，重新分配 order 权重 (0, 1000, 2000...)
    const withUpdatedOrder = newArticles.map((art, index) => ({
      ...art,
      order: index * 1000
    }));

    // 此时 enforceOrder 将按照新分配的 order 进行稳定排序
    const ordered = sortArticlesByPriority(withUpdatedOrder);
    setArticles(ordered);

    // 同步到数据库
    db.clearAndBulkSaveArticles(ordered).catch((e) => {
      console.error('Reorder save failed', e);
      toast.error('排序保存失败，请重试');
    });
  }, []);

  const setArticlesAction = useCallback(async (newArticles: Article[]) => {
    const sanitized = sanitizeArticles(newArticles); // 先清洗类型
    const ordered = sortArticlesByPriority(sanitized);
    try {
      await db.clearAndBulkSaveArticles(ordered);
      setArticles(ordered);
      if (ordered.length > 0) setCurrentId(ordered[0].id);
    } catch (e) {
      console.error("Bulk save failed", e);
      toast.error('批量保存失败，请重试');
    }
  }, [sanitizeArticles]);

  return {
    articles,
    currentId,
    loading,
    setCurrentId,
    updateArticle,
    createArticle,
    deleteArticle,
    reorderArticles,
    setArticlesAction
  };
}
