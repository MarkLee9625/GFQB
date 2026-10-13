import { useState, useEffect, useCallback, useRef } from 'react';
import type { Article } from '../src/types';
import { db } from '../services/db';
import { sortArticlesByPriority } from '../src/utils/articleSort';
import { parseEmbeddedData } from '../src/utils/embeddedData';
import { toast } from '../src/utils/toast';
import { generateArticleId, createDefaultSpecialArticles } from '../src/utils/articleDefaults';
import { isSpecialCategory } from '../src/constants';
import { migrateArticlesToMediaRefs, findMissingMediaHashes } from '../services/mediaStore';

/** 保存防抖窗口：连续编辑合并为一次落盘 */
const SAVE_DEBOUNCE_MS = 1000;
/** 保存最长等待：防抖被连续编辑不断重置时，仍保证该时间内落盘一次 */
const SAVE_MAX_WAIT_MS = 3000;

interface PendingSave {
  article: Article;
  timer: ReturnType<typeof setTimeout>;
  /** 本轮连续编辑的首次入队时间（maxWait 计时起点） */
  queuedAt: number;
}

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
      const safeId = (!isNaN(numId) && numId !== 0) ? numId : generateArticleId(index + 1);

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
        let data = sanitizeArticles(rawData);

        if (data.length === 0) {
          const fresh = createDefaultSpecialArticles();
          await db.clearAndBulkSaveArticles(fresh);
          if (aborted()) return;
          data = fresh;
        }

        // P0-A：旧库媒体拆表迁移（幂等、可中断续跑）。
        // 在进入可编辑状态前完成，避免迁移写回与用户编辑竞争互相覆盖；
        // 迁移后回读瘦身版文章，使内存收益立即生效。
        try {
          const migration = await migrateArticlesToMediaRefs({
            articles: data,
            onStart: (total) => {
              if (total > 0 && mountedRef.current) toast.info(`正在整理媒体库（一次性，共 ${total} 篇）…`);
            },
          });
          if (aborted()) return;
          if (!migration.skipped) {
            data = sanitizeArticles(await db.getArticles());
            if (aborted()) return;
            if (mountedRef.current) toast.success(`媒体库整理完成（共 ${migration.media} 项媒体）`);
          }
        } catch (e) {
          console.warn('[媒体库] 迁移失败，下次启动将重试', e);
        }

        const ordered = sortArticlesByPriority(data);
        if (aborted()) return;
        setArticles(ordered);
        if (ordered.length > 0) setCurrentId(ordered[0].id);
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

  // ---- 保存调度：按文章 id 分桶防抖 + maxWait 上限 + 可 flush ----
  // 分桶理由：不同文章的保存互不取消（单一 debounce 实例会清掉前一篇的保存导致丢失）
  const pendingSavesRef = useRef<Map<number, PendingSave>>(new Map());
  /** 失败重试计数（成功/取消即清零，超过上限放弃并提示） */
  const retryCountsRef = useRef<Map<number, number>>(new Map());
  const MAX_SAVE_RETRIES = 3;
  /** debouncedSaveArticle 的自引用：persistNow 失败后需重新入队（避免两个 useCallback 循环依赖） */
  const debouncedSaveRef = useRef<((article: Article) => void) | null>(null);

  // P0-A 参考：article 最新值的稳定读取口（UPDATE 的浅比较与落盘都在 updater 之外使用）
  const articlesRef = useRef(articles);
  articlesRef.current = articles;

  const persistNow = useCallback(async (article: Article) => {
    const id = Number(article.id);
    try {
      await db.saveArticle(article);
      retryCountsRef.current.delete(id);
    } catch (e) {
      console.error('Save failed', e);
      const attempts = (retryCountsRef.current.get(id) ?? 0) + 1;
      retryCountsRef.current.set(id, attempts);
      if (attempts <= MAX_SAVE_RETRIES) {
        // 必须自动重试：state 已等于目标值，用户再点"保存"会被浅比较 bailout 吞掉（写不进去）
        toast.error(`文章保存失败，正在自动重试（${attempts}/${MAX_SAVE_RETRIES}）`);
        debouncedSaveRef.current?.(article);
      } else {
        retryCountsRef.current.delete(id);
        toast.error('文章保存失败：已重试多次，请检查磁盘空间或刷新页面');
      }
    }
  }, []);

  const cancelPendingSave = useCallback((id: number) => {
    const entry = pendingSavesRef.current.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      pendingSavesRef.current.delete(id);
    }
    retryCountsRef.current.delete(id);
  }, []);

  const cancelAllPendingSaves = useCallback(() => {
    for (const [, entry] of pendingSavesRef.current) clearTimeout(entry.timer);
    pendingSavesRef.current.clear();
  }, []);

  const debouncedSaveArticle = useCallback((article: Article) => {
    const id = Number(article.id);
    const pending = pendingSavesRef.current;
    const existing = pending.get(id);
    if (existing) clearTimeout(existing.timer);

    const queuedAt = existing?.queuedAt ?? Date.now();
    // maxWait 兜底：连续编辑时延迟逐步收敛，最迟 queuedAt + SAVE_MAX_WAIT_MS 落盘
    const delay = Math.min(SAVE_DEBOUNCE_MS, Math.max(0, queuedAt + SAVE_MAX_WAIT_MS - Date.now()));
    const timer = setTimeout(() => {
      pending.delete(id);
      void persistNow(article);
    }, delay);
    pending.set(id, { article, timer, queuedAt });
  }, [persistNow]);
  debouncedSaveRef.current = debouncedSaveArticle;

  /** 立即执行全部待落盘保存（页面隐藏/关闭、显式保存前调用） */
  const flushPendingSaves = useCallback(async (): Promise<void> => {
    const pending = pendingSavesRef.current;
    if (pending.size === 0) return;
    const jobs: Promise<void>[] = [];
    for (const [id, entry] of Array.from(pending.entries())) {
      clearTimeout(entry.timer);
      pending.delete(id);
      jobs.push(persistNow(entry.article));
    }
    await Promise.all(jobs);
  }, [persistNow]);

  // 页面隐藏/关闭前强制落盘：防抖窗口内的最后一次编辑不再丢失
  // （IndexedDB 事务在页面卸载后仍会继续提交，此处发起 put 即可）
  useEffect(() => {
    const onPageHide = () => { void flushPendingSaves(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flushPendingSaves();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [flushPendingSaves]);

  const updateArticle = useCallback((id: number, updates: Partial<Article>, options?: { immediate?: boolean }) => {
    const numId = Number(id);
    const immediate = options?.immediate === true;

    // 副作用（落盘调度）一律放在 setState 之外：StrictMode 下 updater 会被双调用，
    // 写在里面会让每次保存写两遍（并重跑一遍媒体抽取/哈希），与本次优化目标相反。
    const current = articlesRef.current.find(a => a.id === numId);
    if (!current) return;

    // 浅比较 bailout：更新字段与现值全等时直接返回，避免无效重渲染与无效写库
    let changed = false;
    for (const key of Object.keys(updates) as (keyof Article)[]) {
      if (!Object.is(current[key], updates[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    const updated = { ...current, ...updates };
    if (immediate) {
      // 显式保存：跳过防抖立即落盘，并取消该文章待执行的防抖保存
      cancelPendingSave(numId);
      void persistNow(updated);
    } else {
      debouncedSaveArticle(updated);
    }

    setArticles(prev => {
      const idx = prev.findIndex(a => a.id === numId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = updated;

      if (updates.category !== undefined) {
        const oldCategory = prev[idx].category;
        if (isSpecialCategory(updates.category) || isSpecialCategory(oldCategory)) {
          return sortArticlesByPriority(next);
        }
      }
      return next;
    });
  }, [debouncedSaveArticle, persistNow, cancelPendingSave]);

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

    if (isSpecialCategory(art?.category)) { toast.warning('封面和封底不可删除'); return; }
    if (!window.confirm('确定要删除这篇文章吗？')) return;

    try {
      // 先取消待落盘保存，避免删除后又被防抖定时器写回（文章复活）
      cancelPendingSave(Number(id));
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
  }, [cancelPendingSave]);

  const reorderArticles = useCallback((newArticles: Article[]) => {
    // 核心修复：根据拖拽后的新顺序，重新分配 order 权重 (0, 1000, 2000...)
    const withUpdatedOrder = newArticles.map((art, index) => ({
      ...art,
      order: index * 1000
    }));

    // 此时 enforceOrder 将按照新分配的 order 进行稳定排序
    const ordered = sortArticlesByPriority(withUpdatedOrder);
    setArticles(ordered);

    // 同步到数据库：排序无增删，用轻量 upsert，避免 clear+游标删除全表重写大 base64
    // 同时取消待落盘保存：本次 upsert 已含全部文章最新状态，旧任务会把过期 order 写回
    cancelAllPendingSaves();
    db.bulkPutArticles(ordered).catch((e) => {
      console.error('Reorder save failed', e);
      toast.error('排序保存失败，请重试');
    });
  }, [cancelAllPendingSaves]);

  const setArticlesAction = useCallback(async (newArticles: Article[]) => {
    const sanitized = sanitizeArticles(newArticles); // 先清洗类型
    const ordered = sortArticlesByPriority(sanitized);
    try {
      // 整表替换前取消全部待落盘保存，避免旧文章被防抖定时器写回
      cancelAllPendingSaves();
      await db.clearAndBulkSaveArticles(ordered);
      setArticles(ordered);
      if (ordered.length > 0) setCurrentId(ordered[0].id);

      // 悬空引用守卫：导入"含引用但本地媒体库没有"的项目文件时给出可见告警
      // （生产构建会 drop console，仅靠 warn 用户完全无感）
      const missing = await findMissingMediaHashes(ordered);
      if (missing.length > 0) {
        toast.warning(`有 ${missing.length} 项媒体在本地媒体库中缺失（常见于跨设备导入的项目文件），相关图片/附件将无法显示`);
      }
    } catch (e) {
      console.error("Bulk save failed", e);
      toast.error('批量保存失败，请重试');
    }
  }, [sanitizeArticles, cancelAllPendingSaves]);

  return {
    articles,
    currentId,
    loading,
    setCurrentId,
    updateArticle,
    createArticle,
    deleteArticle,
    reorderArticles,
    setArticlesAction,
    flushPendingSaves
  };
}
