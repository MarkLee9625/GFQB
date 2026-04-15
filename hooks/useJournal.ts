import { useState, useEffect, useCallback, useRef } from 'react';
import { Article } from '../types';
import { db } from '../services/db';

export function useJournal() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // 核心：强制排序逻辑
  const enforceOrder = useCallback((list: Article[]): Article[] => {
    const cover = list.find(a => a.category === '封面');
    const back = list.find(a => a.category === '封底');
    // 修复：增加 sort 确保普通文章严格按照 order 排序
    const others = list
      .filter(a => a.category !== '封面' && a.category !== '封底')
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    return [
      ...(cover ? [cover] : []),
      ...others,
      ...(back ? [back] : [])
    ];
  }, []); // 保持引用稳定

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

  // 简易 debounce 实现
  const debounce = (fn: Function, ms = 1000) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  // 初始化加载
  useEffect(() => {
    async function load() {
      try {
        // 关键修复：确保数据库先连接
        await db.init();

        const rawData = await db.getArticles();
        // 使用统一的清洗函数确保所有 ID 和 Order 都是数字类型
        const data = sanitizeArticles(rawData);

        // 兜底逻辑：如果数据为空，创建默认封面和封底
        if (data.length === 0) {
          const now = Date.now();
          const fresh: Article[] = [
            {
              id: now,
              title: "封面",
              category: "封面",
              content: "",
              issueText: "NO.01",
              dateText: "JAN " + new Date().getFullYear(),
              order: 0
            },
            {
              id: now + 1,
              title: "封底",
              category: "封底",
              content: "",
              order: 99999
            }
          ];
          await db.clearAndBulkSaveArticles(fresh);
          setArticles(fresh);
          setCurrentId(fresh[0].id);
        } else {
          const ordered = enforceOrder(data);
          setArticles(ordered);
          if (ordered.length > 0) setCurrentId(ordered[0].id);
        }
      } catch (e) {
        console.error('Failed to load articles', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sanitizeArticles, enforceOrder]);

  const debouncedSaveArticle = useRef(
    debounce(async (article: Article) => {
      try {
        await db.saveArticle(article);
      } catch (e) {
        console.error('Save failed', e);
      }
    }, 1000)
  ).current;

  const updateArticle = useCallback((id: number, updates: Partial<Article>) => {
    const numId = Number(id);
    setArticles(prev => {
      const idx = prev.findIndex(a => a.id === numId);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...updates };
      debouncedSaveArticle(updated);
      const next = [...prev];
      next[idx] = updated;

      // 如果更新了 category，可能需要重新排序
      if (updates.category === '封面' || updates.category === '封底') {
        return enforceOrder(next);
      }
      return next;
    });
  }, [debouncedSaveArticle, enforceOrder]);

  const articlesRef = useRef(articles);
  articlesRef.current = articles;

  const createArticle = useCallback(async (articleData: Partial<Article>) => {
    const maxOrder = articlesRef.current.length > 0
      ? Math.max(...articlesRef.current.map(a => Number(a.order) || 0))
      : 0;

    // 移除 articleData 中可能存在的无效 id，确保不覆盖 Date.now()
    const { id: _, ...restData } = articleData;

    const newArt: Article = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: restData.title || '无标题',
      category: restData.category || '工艺工法',
      content: restData.content || '',
      abstract: restData.abstract || '',
      order: maxOrder + 1000, // 赋予一个足够大的值，确保在所有现有文章之后
      ...restData
    };
    try {
      await db.saveArticle(newArt);
      setArticles(prev => enforceOrder([...prev, newArt]));
      setCurrentId(newArt.id);
      return newArt;
    } catch (e) {
      console.error('Create failed', e);
    }
  }, [enforceOrder]);

  const deleteArticle = useCallback(async (id: number) => {
    // 查找时使用 String 转换，确保能找到 NaN ID 的文章
    const art = articles.find(a => String(a.id) === String(id));

    if (art?.category === '封面' || art?.category === '封底') return alert('封面和封底不可删除');
    if (!window.confirm('确定要删除这篇文章吗？')) return;

    try {
      await db.deleteArticle(id); // 尝试从 DB 删除

      setArticles(prev => {
        // 核心修复：使用 String() 对比，确保 NaN !== NaN 判定为 false，从而成功移除
        const next = prev.filter(a => String(a.id) !== String(id));
        return enforceOrder(next);
      });

      if (currentId === id) setCurrentId(null);
    } catch (e) { console.error('Delete failed', e); }
  }, [articles, currentId, enforceOrder]); // 添加 enforceOrder

  const reorderArticles = useCallback((newArticles: Article[]) => {
    // 核心修复：根据拖拽后的新顺序，重新分配 order 权重 (0, 1000, 2000...)
    const withUpdatedOrder = newArticles.map((art, index) => ({
      ...art,
      order: index * 1000
    }));

    // 此时 enforceOrder 将按照新分配的 order 进行稳定排序
    const ordered = enforceOrder(withUpdatedOrder);
    setArticles(ordered);

    // 同步到数据库
    db.clearAndBulkSaveArticles(ordered).catch(console.error);
  }, [enforceOrder]);

  const setArticlesAction = useCallback(async (newArticles: Article[]) => {
    const sanitized = sanitizeArticles(newArticles); // 先清洗类型
    const ordered = enforceOrder(sanitized);
    try {
      await db.clearAndBulkSaveArticles(ordered);
      setArticles(ordered);
      if (ordered.length > 0) setCurrentId(ordered[0].id);
    } catch (e) {
      console.error("Bulk save failed", e);
    }
  }, [sanitizeArticles, enforceOrder]);

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
